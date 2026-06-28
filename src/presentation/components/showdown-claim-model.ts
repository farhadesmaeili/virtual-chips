// Pure derivations for the player-showdown claim tray (mode B, task 6.1 PR3).
// In showdown mode every live contender claims `'win'` or `'muck'` for THEMSELVES
// (`player:claim`); the banker then confirms via the existing `hand:settle` path,
// where the server seeds winners from the stored claims and ignores any
// client-passed declarations. This module only shapes hand state for display and
// gates the banker's confirm button for UX — it never moves chips and never
// builds per-pot winner sets. The server's settle is the sole authority.

import type {
  PlayerState,
  PublicHandPlayer,
  PublicRoomMember,
} from '@/presentation/lib/socket-events';

/** The two claim verbs a contender may send on `player:claim`. */
export type ClaimChoice = 'win' | 'muck';

/** How a contender reads at a glance in the roster. */
export type ClaimStatus = 'claimed' | 'mucked' | 'waiting';

/**
 * Whether a player is a live contender who may claim. This is an EXACT mirror of
 * the server rule in `application/use-cases/record-claim.ts` (the seat-resolved
 * `player.state !== 'active' && player.state !== 'all_in'` rejection): only
 * `active` or `all_in` players contest the pot, so only they get claim controls.
 * Folded / sitting-out players have no stake and no controls. The client copy is
 * advisory — the server re-checks on every `player:claim` — but it must not drift
 * from the server, which `showdown-claim-model.test.ts` asserts per state.
 */
export function isContender(state: PlayerState): boolean {
  return state === 'active' || state === 'all_in';
}

/** Maps a player's stored claim to its roster status (undefined = not yet acted). */
export function claimStatusOf(claim: ClaimChoice | undefined): ClaimStatus {
  return claim === 'win' ? 'claimed' : claim === 'muck' ? 'mucked' : 'waiting';
}

/** One display row in the contender roster, resolved against room members. */
export interface ContenderRow {
  readonly seat: number;
  readonly username: string;
  readonly status: ClaimStatus;
  /** True for the seat the current user occupies (highlights the hero's row). */
  readonly isHero: boolean;
}

/**
 * Builds the roster of live contenders (active / all-in) with each one's claim
 * status, ordered by seat. Folded / sitting-out players are excluded — they are
 * not contesting and cannot claim. `username` resolves from members with the
 * shared `Seat <n>` fallback.
 */
export function buildContenderRoster(
  players: readonly PublicHandPlayer[],
  members: readonly PublicRoomMember[],
  heroSeat: number | null,
): readonly ContenderRow[] {
  const nameOf = (seat: number): string =>
    members.find((m) => m.seat === seat)?.username ?? `Seat ${seat}`;

  return players
    .filter((p) => isContender(p.state))
    .map((p) => ({
      seat: p.seat,
      username: nameOf(p.seat),
      status: claimStatusOf(p.claim),
      isHero: heroSeat !== null && p.seat === heroSeat,
    }))
    .sort((a, b) => a.seat - b.seat);
}

/**
 * The banker's confirm gate — UX ONLY, NOT a safety boundary. The server settles
 * atomically: `settleHand` rejects (and persists nothing) if any contested pot
 * has no claimed winner, so no chips can move on a premature or all-muck confirm.
 * This gate just keeps the banker from clicking into that guaranteed rejection:
 *
 * - `canConfirm` is true only once EVERY contender has resolved (claimed or
 *   mucked) AND at least one of them claimed `'win'`.
 * - Until all contenders have acted, the button is quietly disabled (`reason`
 *   null) — the roster already shows who is still "waiting".
 * - When everyone has resolved but no one claimed `'win'` (all-muck), the button
 *   stays disabled and `reason` surfaces a clear prompt.
 */
export interface ConfirmGate {
  readonly canConfirm: boolean;
  /** A message to show when confirm is blocked for a reason worth stating. */
  readonly reason: string | null;
}

export function deriveConfirmGate(
  players: readonly PublicHandPlayer[],
): ConfirmGate {
  const contenders = players.filter((p) => isContender(p.state));
  const allResolved =
    contenders.length > 0 && contenders.every((p) => p.claim !== undefined);
  if (!allResolved) return { canConfirm: false, reason: null };

  const anyWin = contenders.some((p) => p.claim === 'win');
  if (!anyWin) {
    return {
      canConfirm: false,
      reason: 'No winner claimed — someone must claim win.',
    };
  }
  return { canConfirm: true, reason: null };
}
