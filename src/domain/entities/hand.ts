import { Chips } from '../value-objects/chips';
import type { PlayerInHand } from './player-in-hand';
import type { Pot } from './pot';

export type HandStatus = 'betting' | 'awaiting_showdown' | 'settled';

/**
 * The full state of one Hand. Immutable: helpers return a new Hand.
 * This shape is what gets persisted as `Hand.state` (JSON) for history.
 */
export interface Hand {
  readonly id: string;
  readonly roomId: string;
  /** Betting street index (0 = first). Just a label for the engine. */
  readonly street: number;
  readonly players: readonly PlayerInHand[];
  readonly buttonSeat: number;
  /** Highest amount committed by any player this street. */
  readonly currentBet: number;
  /** Size of the last bet/raise this street (for min-raise calculation). */
  readonly lastRaiseSize: number;
  readonly actingSeat: number | null;
  /** Epoch-ms deadline for the acting player, or null when no one is acting. */
  readonly actionDeadline: number | null;
  readonly pots: readonly Pot[];
  readonly status: HandStatus;
}

export interface CreateHandInput {
  id: string;
  roomId: string;
  players: readonly PlayerInHand[];
  buttonSeat: number;
  street?: number;
  currentBet?: number;
  lastRaiseSize?: number;
  pots?: readonly Pot[];
}

export function createHand(input: CreateHandInput): Hand {
  return {
    id: input.id,
    roomId: input.roomId,
    street: input.street ?? 0,
    players: [...input.players],
    buttonSeat: input.buttonSeat,
    currentBet: input.currentBet ?? 0,
    lastRaiseSize: input.lastRaiseSize ?? 0,
    actingSeat: null,
    actionDeadline: null,
    pots: input.pots ? [...input.pots] : [],
    status: 'betting',
  };
}

export function getPlayer(hand: Hand, seat: number): PlayerInHand | undefined {
  return hand.players.find((p) => p.seat === seat);
}

/**
 * Replaces the player sitting at `seat` with the result of `fn`, immutably.
 * If no player occupies that seat the hand is returned unchanged.
 */
export function updatePlayer(
  hand: Hand,
  seat: number,
  fn: (player: PlayerInHand) => PlayerInHand,
): Hand {
  return {
    ...hand,
    players: hand.players.map((p) => (p.seat === seat ? fn(p) : p)),
  };
}

/** Players who can still be asked to act. */
export function activePlayers(hand: Hand): readonly PlayerInHand[] {
  return hand.players.filter((p) => p.state === 'active');
}

/** Players still contesting the pots (active or all-in, not folded / out). */
export function contenders(hand: Hand): readonly PlayerInHand[] {
  return hand.players.filter(
    (p) => p.state === 'active' || p.state === 'all_in',
  );
}

/** Total chips across all pots. */
export function totalPot(hand: Hand): number {
  return hand.pots.reduce(
    (sum, pot) => sum.add(Chips.of(pot.amount)),
    Chips.zero(),
  ).value;
}
