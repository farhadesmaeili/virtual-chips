import { describe, expect, it } from 'vitest';
import { buildNetReport } from './net-report-model';
import type {
  GameEnded,
  PublicRoomMember,
} from '@/presentation/lib/socket-events';

const member = (
  seat: number,
  username: string,
  over: Partial<PublicRoomMember> = {},
): PublicRoomMember => ({
  seat,
  username,
  chips: 0,
  buyInTotal: 0,
  isBanker: false,
  sittingOut: false,
  ...over,
});

// A three-handed game: alice up, carol flat, bob down. Zero-sum (rake 0).
const MEMBERS: readonly PublicRoomMember[] = [
  member(0, 'alice'),
  member(1, 'bob'),
  member(2, 'carol'),
];
const NETS: GameEnded['nets'] = [
  { seat: 1, net: -700 },
  { seat: 0, net: 700 },
  { seat: 2, net: 0 },
];

describe('buildNetReport', () => {
  it('orders rows by net descending (biggest winner first)', () => {
    const rows = buildNetReport(NETS, MEMBERS);
    expect(rows.map((r) => r.seat)).toEqual([0, 2, 1]);
    expect(rows.map((r) => r.net)).toEqual([700, 0, -700]);
  });

  it('classifies each row as win / loss / even by the sign of net', () => {
    const rows = buildNetReport(NETS, MEMBERS);
    expect(rows.find((r) => r.seat === 0)?.kind).toBe('win');
    expect(rows.find((r) => r.seat === 2)?.kind).toBe('even');
    expect(rows.find((r) => r.seat === 1)?.kind).toBe('loss');
  });

  it('breaks net ties by seat so equal nets keep a deterministic order', () => {
    const rows = buildNetReport(
      [
        { seat: 2, net: 50 },
        { seat: 0, net: 50 },
        { seat: 1, net: -100 },
      ],
      MEMBERS,
    );
    expect(rows.map((r) => r.seat)).toEqual([0, 2, 1]);
  });

  it('falls back to "Seat <n>" when the seat has no current member', () => {
    // Seat 1 left the table before the game ended, so it is absent from members.
    const rows = buildNetReport(NETS, [member(0, 'alice'), member(2, 'carol')]);
    expect(rows.find((r) => r.seat === 1)?.username).toBe('Seat 1');
    expect(rows.find((r) => r.seat === 0)?.username).toBe('alice');
  });

  it('keeps the zero-sum invariant: sum(rows.net) + rake === 0 (rake = 0)', () => {
    const rake = 0;
    const rows = buildNetReport(NETS, MEMBERS);
    const sum = rows.reduce((acc, r) => acc + r.net, 0);
    expect(sum + rake).toBe(0);
  });

  it('keeps the zero-sum invariant with rake carved out: sum(rows.net) + rake === 0 (rake > 0)', () => {
    // Rake of 50 was removed from the zero-sum total, so the player nets sum to
    // -50; the invariant sum(nets) + rake === 0 holds for non-zero rake too.
    const rake = 50;
    const nets: GameEnded['nets'] = [
      { seat: 0, net: 650 },
      { seat: 2, net: 0 },
      { seat: 1, net: -700 },
    ];
    const rows = buildNetReport(nets, MEMBERS);
    const sum = rows.reduce((acc, r) => acc + r.net, 0);
    expect(sum).toBe(-rake);
    expect(sum + rake).toBe(0);
  });
});
