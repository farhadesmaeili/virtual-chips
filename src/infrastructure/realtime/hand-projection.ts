import type {
  ActionVerb,
  ClaimChoice,
  Hand,
  HandStatus,
  PlayerState,
} from '@/domain/entities';
import { calculateSidePotsForPlayers } from '@/domain/engine';

/** A player as broadcast in the hand state — seat-based, no raw userId. */
export interface PublicHandPlayer {
  readonly seat: number;
  readonly stack: number;
  readonly committedThisStreet: number;
  readonly committedTotal: number;
  readonly state: PlayerState;
  readonly hasActedThisStreet: boolean;
  /**
   * The player's last action this hand (verb only, no amount), or null before
   * they act. Survives reconnect/resync since it lives in the hand state.
   */
  readonly lastAction: ActionVerb | null;
  /** Time-bank extensions left this hand (task 4.12); drives the hero's button. */
  readonly timeExtensionsRemaining: number;
  /**
   * The player's player-showdown claim (mode B, 6.1), or absent when unclaimed /
   * not at showdown. Additive: it rides `hand:state` only (never the
   * animation-trigger events), and survives resync since it lives in the hand
   * state. Consumed by the claim UI in PR3.
   */
  readonly claim?: ClaimChoice;
}

export interface PublicPot {
  readonly amount: number;
  readonly eligibleSeats: readonly number[];
}

/** Display-only hand state broadcast on `hand:state`. */
export interface PublicHandState {
  readonly id: string;
  readonly roomId: string;
  readonly street: number;
  readonly buttonSeat: number;
  readonly currentBet: number;
  /** Size of the last full bet/raise this street; the min-raise increment. */
  readonly lastRaiseSize: number;
  readonly actingSeat: number | null;
  readonly actionDeadline: number | null;
  readonly status: HandStatus;
  readonly players: readonly PublicHandPlayer[];
  readonly pots: readonly PublicPot[];
  readonly totalPot: number;
}

/**
 * Projects a domain Hand to its public state. Side pots are derived from
 * committedTotal. Players are keyed by seat (clients map seat -> username via
 * room:state); raw userIds are never broadcast.
 */
export function toPublicHandState(hand: Hand): PublicHandState {
  const pots = calculateSidePotsForPlayers(hand.players);
  return {
    id: hand.id,
    roomId: hand.roomId,
    street: hand.street,
    buttonSeat: hand.buttonSeat,
    currentBet: hand.currentBet,
    lastRaiseSize: hand.lastRaiseSize,
    actingSeat: hand.actingSeat,
    actionDeadline: hand.actionDeadline,
    status: hand.status,
    players: hand.players.map((p) => ({
      seat: p.seat,
      stack: p.stack,
      committedThisStreet: p.committedThisStreet,
      committedTotal: p.committedTotal,
      state: p.state,
      hasActedThisStreet: p.hasActedThisStreet,
      lastAction: p.lastAction,
      timeExtensionsRemaining: p.timeExtensionsRemaining,
      claim: p.claim,
    })),
    pots: pots.map((pot) => ({
      amount: pot.amount,
      eligibleSeats: pot.eligibleSeats,
    })),
    totalPot: pots.reduce((sum, pot) => sum + pot.amount, 0),
  };
}
