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
import { firstButtonSeat, nextButtonSeat, postBlinds } from '@/domain/engine';
import {
  HandInProgressError,
  NotBankerError,
  NotEnoughPlayersError,
  RoomNotFoundError,
} from '@/domain/errors';

export interface StartHandInput {
  readonly roomId: string;
  readonly requesterId: string;
}

/**
 * Starts a new hand. Only the banker may start one. Funded members (chips > 0)
 * are dealt in. The button is the lowest occupied seat for the first hand, then
 * rotates clockwise to the next occupied seat after each settled hand. The
 * small and big blinds are posted from the room settings and the first actor is
 * the seat left of the big blind (or the button itself, heads-up).
 */
export class StartHand {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly hands: HandStore,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute({ roomId, requesterId }: StartHandInput): Promise<Hand> {
    const room = await this.rooms.findById(roomId);
    if (room === null) throw new RoomNotFoundError(roomId);
    if (!isBanker(room, requesterId)) throw new NotBankerError(requesterId);

    const existing = await this.hands.get(roomId);
    if (existing !== null && existing.status !== 'settled') {
      throw new HandInProgressError(roomId);
    }

    const members = await this.rooms.listMembers(roomId);
    const funded = members.filter((m) => m.chips > 0);
    if (funded.length < 2) throw new NotEnoughPlayersError(roomId);

    const players = funded.map((m) =>
      createPlayerInHand({ seat: m.seat, userId: m.userId, stack: m.chips }),
    );
    const fundedSeats = funded.map((m) => m.seat);
    // First hand: lowest seat. Subsequent hands rotate the button clockwise from
    // the previous (settled) hand's button.
    const buttonSeat =
      existing === null
        ? firstButtonSeat(fundedSeats)
        : nextButtonSeat(fundedSeats, existing.buttonSeat);
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
    await this.rooms.updateStatus(roomId, 'playing');
    return hand;
  }
}
