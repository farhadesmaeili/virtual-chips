import {
  RoomStatus as PrismaRoomStatus,
  SettlementMode as PrismaSettlementMode,
} from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  toDomainRoom,
  toDomainRoomStatus,
  toDomainSettlementMode,
  toPrismaRoomStatus,
  toPrismaSettlementMode,
  type PrismaRoomRow,
} from './mappers';

describe('room status mapping', () => {
  it('maps database -> domain', () => {
    expect(toDomainRoomStatus(PrismaRoomStatus.WAITING)).toBe('waiting');
    expect(toDomainRoomStatus(PrismaRoomStatus.PLAYING)).toBe('playing');
    expect(toDomainRoomStatus(PrismaRoomStatus.ENDED)).toBe('ended');
  });

  it('maps domain -> database', () => {
    expect(toPrismaRoomStatus('waiting')).toBe(PrismaRoomStatus.WAITING);
    expect(toPrismaRoomStatus('playing')).toBe(PrismaRoomStatus.PLAYING);
    expect(toPrismaRoomStatus('ended')).toBe(PrismaRoomStatus.ENDED);
  });

  it('round-trips every status', () => {
    for (const s of ['waiting', 'playing', 'ended'] as const) {
      expect(toDomainRoomStatus(toPrismaRoomStatus(s))).toBe(s);
    }
  });
});

describe('settlement mode mapping', () => {
  it('maps both directions', () => {
    expect(toDomainSettlementMode(PrismaSettlementMode.BANKER)).toBe('banker');
    expect(toDomainSettlementMode(PrismaSettlementMode.SHOWDOWN)).toBe(
      'showdown',
    );
    expect(toPrismaSettlementMode('banker')).toBe(PrismaSettlementMode.BANKER);
    expect(toPrismaSettlementMode('showdown')).toBe(
      PrismaSettlementMode.SHOWDOWN,
    );
  });
});

describe('toDomainRoom', () => {
  const row: PrismaRoomRow = {
    id: 'r1',
    name: 'Table',
    bankerId: 'u1',
    status: PrismaRoomStatus.PLAYING,
    actionTimeoutMs: 20000,
    // Chip columns come back from Prisma as bigint; the mapper converts them.
    smallBlind: 5n,
    bigBlind: 10n,
    minBuyIn: 100n,
    maxBuyIn: 200n,
    settlementMode: PrismaSettlementMode.SHOWDOWN,
  };

  it('rebuilds the domain Room with mapped enums and nested settings', () => {
    expect(toDomainRoom(row)).toEqual({
      id: 'r1',
      name: 'Table',
      bankerId: 'u1',
      status: 'playing',
      settings: {
        actionTimeoutMs: 20000,
        smallBlind: 5,
        bigBlind: 10,
        minBuyIn: 100,
        maxBuyIn: 200,
        settlementMode: 'showdown',
      },
    });
  });

  it('carries a null maxBuyIn (no maximum) through unchanged', () => {
    expect(
      toDomainRoom({ ...row, maxBuyIn: null }).settings.maxBuyIn,
    ).toBeNull();
  });
});
