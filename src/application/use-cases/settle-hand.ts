import type { HandStore, RoomRepository } from '@/application/ports';
import { isBanker, type Hand } from '@/domain/entities';
import { settleHand, type PotDeclaration } from '@/domain/engine';
import {
  NoActiveHandError,
  NotBankerError,
  RoomNotFoundError,
} from '@/domain/errors';
import { toRoomSnapshot, type RoomSnapshot } from './room-snapshot';

export interface SettleHandInput {
  readonly roomId: string;
  readonly requesterId: string;
  /**
   * Winner seats per pot (aligned with the hand's side pots). Required for
   * contested pots; ignored for uncontested ones, which auto-award.
   */
  readonly declarations?: readonly PotDeclaration[];
}

export interface SettleHandResult {
  readonly hand: Hand;
  /** Chips won per seat (only winning seats appear). */
  readonly payouts: ReadonlyMap<number, number>;
  /** The room after winnings are written back to members' stacks. */
  readonly snapshot: RoomSnapshot;
}

/**
 * Settles the current hand: the banker declares the winner(s) of each contested
 * pot (uncontested pots auto-award), the pure engine moves the chips, and each
 * player's final stack is persisted to their room member so the next hand starts
 * from the right stacks.
 *
 * Server-authoritative: only the banker may settle, and all chip movement runs
 * in the pure `settleHand` engine — never trusted from the client.
 */
export class SettleHand {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly hands: HandStore,
  ) {}

  async execute({
    roomId,
    requesterId,
    declarations = [],
  }: SettleHandInput): Promise<SettleHandResult> {
    const room = await this.rooms.findById(roomId);
    if (room === null) throw new RoomNotFoundError(roomId);
    if (!isBanker(room, requesterId)) throw new NotBankerError(requesterId);

    const hand = await this.hands.get(roomId);
    if (hand === null) throw new NoActiveHandError(roomId);

    // Pure settlement (validates the hand is awaiting showdown and the
    // declarations are well-formed; throws a typed domain error otherwise).
    const { hand: settled, payouts } = settleHand(hand, declarations);

    // Persist every dealt player's final stack so the next hand is funded
    // correctly (winners up, losers down by what they committed).
    for (const player of settled.players) {
      await this.rooms.updateMemberChips(roomId, player.userId, player.stack);
    }
    await this.hands.save(roomId, settled);

    const members = await this.rooms.listMembers(roomId);
    return { hand: settled, payouts, snapshot: toRoomSnapshot(room, members) };
  }
}
