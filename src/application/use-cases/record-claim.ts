import type { HandStore, RoomRepository } from '@/application/ports';
import { updatePlayer, type ClaimChoice, type Hand } from '@/domain/entities';
import {
  HandNotInShowdownError,
  InvalidActionError,
  NoActiveHandError,
  RoomNotFoundError,
} from '@/domain/errors';

export interface RecordClaimInput {
  readonly roomId: string;
  /** The authenticated session user; the seat is resolved from this, never a payload. */
  readonly userId: string;
  readonly claim: ClaimChoice;
}

export interface RecordClaimResult {
  readonly hand: Hand;
}

/**
 * Records a player's player-showdown claim (mode B, docs/BETTING-ENGINE.md §5):
 * an active contender claims `'win'` or `'muck'` for themselves while the hand is
 * awaiting showdown. The claim is advisory and moves no chips — it is written
 * only onto the Hand (single source of truth) and is later turned into the
 * banker-confirm declarations by `claimsToDeclarations` (run inside `SettleHand`).
 *
 * Server-authoritative + self-only (IDOR): the claiming seat is resolved from the
 * authenticated `userId`, never the payload, mirroring {@link PlayerAct}.
 */
export class RecordClaim {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly hands: HandStore,
  ) {}

  async execute({
    roomId,
    userId,
    claim,
  }: RecordClaimInput): Promise<RecordClaimResult> {
    const room = await this.rooms.findById(roomId);
    if (room === null) throw new RoomNotFoundError(roomId);

    // Claims exist only in player-showdown mode. In banker mode the banker
    // declares winners directly, so there is nothing to claim.
    if (room.settings.settlementMode !== 'showdown') {
      throw new InvalidActionError('claims are not enabled in this room');
    }

    const hand = await this.hands.get(roomId);
    if (hand === null) throw new NoActiveHandError(roomId);

    // Claims are only meaningful at showdown — reject betting / awaiting_street /
    // already-settled hands so a stale claim can never mutate a settled hand.
    if (hand.status !== 'awaiting_showdown') {
      throw new HandNotInShowdownError(hand.status);
    }

    // Self-only / IDOR: the seat comes from the authenticated session user, never
    // the payload. A client can therefore never claim for a different seat.
    const player = hand.players.find((p) => p.userId === userId);
    if (player === undefined) {
      throw new InvalidActionError('you are not in this hand');
    }

    // Only a live contender may claim. Mucking is a claim VALUE, not a folded
    // state, so a non-folded player may still claim `'muck'`; folded / sitting-out
    // players have no stake to claim.
    if (player.state !== 'active' && player.state !== 'all_in') {
      throw new InvalidActionError('you are not contesting this hand');
    }

    // Idempotent overwrite of the player's OWN claim, written only on the Hand
    // (no side store — the Hand is the single source of truth, survives resync).
    const updated = updatePlayer(hand, player.seat, (p) => ({ ...p, claim }));
    await this.hands.save(roomId, updated);
    return { hand: updated };
  }
}
