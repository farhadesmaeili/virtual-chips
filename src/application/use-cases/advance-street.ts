import type { Clock, HandStore, RoomRepository } from '@/application/ports';
import { isBanker, type Hand } from '@/domain/entities';
import { dealNextStreet } from '@/domain/engine';
import {
  InvalidActionError,
  NoActiveHandError,
  NotBankerError,
  RoomNotFoundError,
} from '@/domain/errors';

export interface AdvanceStreetInput {
  readonly roomId: string;
  readonly requesterId: string;
}

/**
 * Deals the next street at the banker's confirmation (task 4.7). The game pauses
 * after each street's betting (`awaiting_street`) and only the banker advances
 * it, because a human paces the physical cards. The next actor's deadline is set
 * here (or cleared when the new street has no one to act, e.g. an all-in run-out
 * that pauses again).
 *
 * Server-authoritative: only the banker may advance, and only from
 * `awaiting_street`.
 */
export class AdvanceStreet {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly hands: HandStore,
    private readonly clock: Clock,
  ) {}

  async execute({ roomId, requesterId }: AdvanceStreetInput): Promise<Hand> {
    const room = await this.rooms.findById(roomId);
    if (room === null) throw new RoomNotFoundError(roomId);
    if (!isBanker(room, requesterId)) throw new NotBankerError(requesterId);

    const hand = await this.hands.get(roomId);
    if (hand === null) throw new NoActiveHandError(roomId);
    if (hand.status !== 'awaiting_street') {
      throw new InvalidActionError('this hand is not waiting for a street');
    }

    const advanced = dealNextStreet(hand, { minBet: room.settings.bigBlind });
    const withDeadline: Hand = {
      ...advanced,
      actionDeadline:
        advanced.actingSeat === null
          ? null
          : this.clock.now() + room.settings.actionTimeoutMs,
    };

    await this.hands.save(roomId, withDeadline);
    return withDeadline;
  }
}
