import type {
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
import { firstActiveAfterButton } from '@/domain/engine';
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
 * are dealt in; the button is the lowest occupied seat (static rotation for
 * now) and the first actor is the seat to its left. No blinds are posted yet.
 */
export class StartHand {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly hands: HandStore,
    private readonly ids: IdGenerator,
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
    const buttonSeat = Math.min(...funded.map((m) => m.seat));
    const minBet = room.settings.bigBlind;

    const base = createHand({
      id: this.ids.generate(),
      roomId,
      players,
      buttonSeat,
      lastRaiseSize: minBet,
    });
    const hand: Hand = { ...base, actingSeat: firstActiveAfterButton(base) };

    await this.hands.save(roomId, hand);
    await this.rooms.updateStatus(roomId, 'playing');
    return hand;
  }
}
