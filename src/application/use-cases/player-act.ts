import type { HandStore, RoomRepository } from '@/application/ports';
import type { Hand } from '@/domain/entities';
import { advanceHand, applyAction, type ActionType } from '@/domain/engine';
import {
  InvalidActionError,
  NoActiveHandError,
  NotYourTurnError,
  RoomNotFoundError,
} from '@/domain/errors';

export interface PlayerActInput {
  readonly roomId: string;
  readonly userId: string;
  readonly action: { readonly type: ActionType; readonly amount?: number };
}

export interface PlayerActResult {
  readonly hand: Hand;
  readonly applied: {
    readonly seat: number;
    readonly type: ActionType;
    readonly amount?: number;
  };
}

/**
 * Applies a betting action and advances the hand.
 *
 * Server-authoritative: the acting identity comes from the authenticated user
 * (mapped to their seat), never the payload. Only the action type and raise
 * amount are taken from the client; chips/pot are computed by the pure engine,
 * which re-validates everything (NotYourTurn, min-raise, etc.).
 */
export class PlayerAct {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly hands: HandStore,
  ) {}

  async execute({
    roomId,
    userId,
    action,
  }: PlayerActInput): Promise<PlayerActResult> {
    const hand = await this.hands.get(roomId);
    if (hand === null) throw new NoActiveHandError(roomId);

    const room = await this.rooms.findById(roomId);
    if (room === null) throw new RoomNotFoundError(roomId);
    const minBet = room.settings.bigBlind;

    const player = hand.players.find((p) => p.userId === userId);
    if (player === undefined) {
      throw new InvalidActionError('you are not in this hand');
    }
    // Authorization: only act on your own turn (the engine re-checks too).
    if (hand.actingSeat !== player.seat) {
      throw new NotYourTurnError(player.seat, hand.actingSeat);
    }

    const afterAction = applyAction(
      hand,
      { seat: player.seat, type: action.type, amount: action.amount },
      minBet,
    );
    const advanced = advanceHand(afterAction, { minBet });

    await this.hands.save(roomId, advanced);
    return {
      hand: advanced,
      applied: { seat: player.seat, type: action.type, amount: action.amount },
    };
  }
}
