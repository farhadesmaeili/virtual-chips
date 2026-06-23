import { describe, expect, it } from 'vitest';
import type { HandSettled } from '@/presentation/lib/socket-events';
import { planChipMotion, seatPoint, type ChipMotion } from './chip-motion';
import { celebrationBursts } from './celebration';

function settled(awards: { seat: number; amount: number }[]): HandSettled {
  return { payouts: awards };
}

describe('celebrationBursts', () => {
  it('raises one burst at the winning seat for a single winner', () => {
    const motion = planChipMotion({
      type: 'settled',
      event: settled([{ seat: 4, amount: 300 }]),
    });
    expect(celebrationBursts(motion)).toEqual([
      { seat: 4, amount: 300, at: seatPoint(4) },
    ]);
  });

  it('fans one burst per winning seat on a split pot', () => {
    const motion = planChipMotion({
      type: 'settled',
      event: settled([
        { seat: 2, amount: 50 },
        { seat: 6, amount: 50 },
      ]),
    });
    expect(celebrationBursts(motion)).toEqual([
      { seat: 2, amount: 50, at: seatPoint(2) },
      { seat: 6, amount: 50, at: seatPoint(6) },
    ]);
  });

  // THE critical correctness property for task 5.4.
  it('raises NO celebration on a settled-hand resync (snapshot replay guard)', () => {
    // A resync/refresh delivers room:state / hand:state SNAPSHOTS (classified as
    // { type: 'snapshot' }), never a replayed hand:settled. So even when the
    // hydrated hand.status is 'settled', the snapshot path maps to null and
    // lights no celebration — a reconnect can never replay a win (no ghost cheer).
    const motion = planChipMotion({ type: 'snapshot' });
    expect(motion).toBeNull();
    expect(celebrationBursts(motion)).toEqual([]);
  });

  it('never celebrates a chip-committing action (only settlements win)', () => {
    const motion = planChipMotion({
      type: 'action',
      event: { seat: 3, action: 'RAISE', amount: 500 },
    });
    expect(celebrationBursts(motion)).toEqual([]);
  });

  it('raises nothing for an empty settlement', () => {
    const motion = planChipMotion({ type: 'settled', event: settled([]) });
    expect(celebrationBursts(motion)).toEqual([]);
  });

  it('defensively ignores a non-winners motion passed directly', () => {
    const commit: ChipMotion = { kind: 'to-pot', fromSeat: 1, amount: 20 };
    expect(celebrationBursts(commit)).toEqual([]);
  });
});
