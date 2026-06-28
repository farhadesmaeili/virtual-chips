import type {
  Clock,
  HandStore,
  IdGenerator,
  RoomRepository,
} from '@/application/ports';
import {
  createHand,
  createPlayerInHand,
  isBanker,
  type Hand,
} from '@/domain/entities';
import { postBlinds } from '@/domain/engine';
import {
  InvalidActionError,
  NoActiveHandError,
  NotBankerError,
  NotEnoughPlayersError,
  RoomNotFoundError,
} from '@/domain/errors';

export interface ResetHandInput {
  readonly roomId: string;
  readonly requesterId: string;
}

/**
 * Discards the in-progress hand and re-deals it (task 6.6) — only this hand, not
 * the whole game and not settlement/history. Only the banker may reset, and only
 * while a hand is actually in progress (any non-settled status).
 *
 * Pure discard-and-re-deal: chips committed during a hand live only inside the
 * Hand object, never in `RoomMember.chips` (those are persisted solely by
 * SettleHand). So this re-derives each player's stack from `RoomMember.chips` —
 * which still holds every player's pre-hand balance — and re-posts the blinds.
 * `updateMemberChips` is never called, so zero-sum is preserved: no DB chips ever
 * moved. (A buy-in approved mid-hand grew `RoomMember.chips` before the reset;
 * reset discards the hand, it does not rewind approved buy-ins, so that player is
 * re-dealt with the larger stack — intended.)
 *
 * The re-deal keeps the current button position (no rotation — it is the same
 * hand) and gets a fresh id; the open Game and the room's `playing` status are
 * left as-is.
 */
export class ResetHand {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly hands: HandStore,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute({ roomId, requesterId }: ResetHandInput): Promise<Hand> {
    const room = await this.rooms.findById(roomId);
    if (room === null) throw new RoomNotFoundError(roomId);
    if (!isBanker(room, requesterId)) throw new NotBankerError(requesterId);

    const current = await this.hands.get(roomId);
    if (current === null) throw new NoActiveHandError(roomId);
    if (current.status === 'settled') {
      throw new InvalidActionError('cannot reset a settled hand');
    }

    const members = await this.rooms.listMembers(roomId);
    // Deal in funded members who are sitting in (mirrors StartHand); stacks are
    // re-derived from the persisted RoomMember.chips, never recomputed from the
    // discarded hand.
    const funded = members.filter((m) => m.chips > 0 && !m.sittingOut);
    if (funded.length < 2) throw new NotEnoughPlayersError(roomId);

    const players = funded.map((m) =>
      createPlayerInHand({ seat: m.seat, userId: m.userId, stack: m.chips }),
    );
    // Re-deal the same hand position — keep the current button (no rotation).
    const buttonSeat = current.buttonSeat;
    const minBet = room.settings.bigBlind;

    const base = createHand({
      id: this.ids.generate(),
      roomId,
      players,
      buttonSeat,
      lastRaiseSize: minBet,
    });
    // Post the mandatory blinds; this also sets currentBet, lastRaiseSize and
    // the first preflop actor.
    const withBlinds = postBlinds(
      base,
      room.settings.smallBlind,
      room.settings.bigBlind,
    );
    const { actingSeat } = withBlinds;
    const hand: Hand = {
      ...withBlinds,
      actionDeadline:
        actingSeat === null
          ? null
          : this.clock.now() + room.settings.actionTimeoutMs,
    };

    await this.hands.save(roomId, hand);
    return hand;
  }
}
