import { z } from 'zod';
import { MAX_BLIND, MAX_CHIP_TOTAL } from '@/domain/entities';

/** Zod schemas for socket payloads (docs/REALTIME-EVENTS.md). */

/**
 * Sane upper bound for a buy-in bound, matching the chips:request cap. Bounded
 * by the technical ceiling (not the 100M product cap) so a banker may set a
 * maxBuyIn above 100M; the per-table product limit is enforced elsewhere.
 */
const MAX_BUY_IN = MAX_CHIP_TOTAL;

export const roomSettingsSchema = z
  .object({
    smallBlind: z.number().int().positive().max(MAX_BLIND).optional(),
    bigBlind: z.number().int().positive().max(MAX_BLIND).optional(),
    actionTimeoutMs: z.number().int().min(1000).optional(),
    // Buy-in bounds: minBuyIn a positive int; maxBuyIn a positive int or null
    // ("no maximum"). Both optional — the server derives them from the big blind
    // when omitted.
    minBuyIn: z.number().int().positive().max(MAX_BUY_IN).optional(),
    maxBuyIn: z.number().int().positive().max(MAX_BUY_IN).nullable().optional(),
    settlementMode: z.enum(['banker', 'showdown']).optional(),
  })
  .strict()
  // Server is authoritative: when both blinds are given, the big blind must be
  // strictly greater than the small blind (client validation is UX only).
  .refine(
    (s) =>
      s.smallBlind === undefined ||
      s.bigBlind === undefined ||
      s.bigBlind > s.smallBlind,
    { message: 'bigBlind must be greater than smallBlind', path: ['bigBlind'] },
  )
  // When both buy-in bounds are given (max not null), the max must be at least
  // the min. A null max means "no maximum" and is always allowed.
  .refine(
    (s) =>
      s.maxBuyIn === undefined ||
      s.maxBuyIn === null ||
      s.minBuyIn === undefined ||
      s.maxBuyIn >= s.minBuyIn,
    { message: 'maxBuyIn must be at least minBuyIn', path: ['maxBuyIn'] },
  );

export const createRoomSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    settings: roomSettingsSchema.optional(),
  })
  .strict();

export const joinRoomSchema = z.object({ roomId: z.string().min(1) }).strict();

export const leaveRoomSchema = z.object({ roomId: z.string().min(1) }).strict();

// Sit out / sit in carry only the roomId; the acting user is always the
// authenticated session user, never taken from the payload (task 4.14 / IDOR).
export const sitOutSchema = z.object({ roomId: z.string().min(1) }).strict();

export const sitInSchema = z.object({ roomId: z.string().min(1) }).strict();

export const resyncRoomSchema = z
  .object({ roomId: z.string().min(1) })
  .strict();

// The lobby's "Your table" query (task 4.13) needs no input: the user is taken
// from the authenticated session, never the payload. An empty .strict() object
// rejects any field — so a client cannot smuggle a userId to read others' rooms.
export const roomsMineSchema = z.object({}).strict();

// The per-user game history query (task 6.3) needs no input: the user is taken
// from the authenticated session, never the payload. An empty .strict() object
// rejects any field — so a client cannot smuggle a userId to read others'
// history.
export const historyMineSchema = z.object({}).strict();

export const handStartSchema = z.object({ roomId: z.string().min(1) }).strict();

export const advanceStreetSchema = z
  .object({ roomId: z.string().min(1) })
  .strict();

// Banker resets (re-deals) the in-progress hand (task 6.6). Carries only the
// roomId; the requester is the authenticated session user and banker-only is
// enforced in the use-case.
export const resetHandSchema = z.object({ roomId: z.string().min(1) }).strict();

// Time bank (task 4.12): carries only the roomId; the acting player is the
// authenticated session user, never the payload (no userId/seat).
export const turnRequestTimeSchema = z
  .object({ roomId: z.string().min(1) })
  .strict();

export const handSettleSchema = z
  .object({
    roomId: z.string().min(1),
    // Winner seats per pot (aligned with the hand's side pots). Optional —
    // uncontested pots auto-award. Seats are validated again by the engine.
    declarations: z.array(z.array(z.number().int().nonnegative())).optional(),
  })
  .strict();

// Banker ends the game (6.2). Carries only the roomId; the requester is the
// authenticated session user and banker-only is enforced in the use-case.
export const endGameSchema = z.object({ roomId: z.string().min(1) }).strict();

export const chipsRequestSchema = z
  .object({
    roomId: z.string().min(1),
    // A sane upper bound so a typo can't request an absurd buy-in.
    amount: z.number().int().positive().max(MAX_CHIP_TOTAL),
  })
  .strict();

export const chipsApproveSchema = z
  .object({ roomId: z.string().min(1), requestId: z.string().min(1) })
  .strict();

export const chipsRejectSchema = z
  .object({ roomId: z.string().min(1), requestId: z.string().min(1) })
  .strict();

// Banker directly adjusts a member's chips (task 6.7). The target is identified
// by seat (the public projection never exposes raw userIds); the requester is
// the authenticated session user and banker-only is enforced in the use-case.
// amount is a signed, nonzero whole number of chips (positive = buy-in, negative
// = correction/cash-out), bounded so a typo can't move an absurd amount.
export const adjustChipsSchema = z
  .object({
    roomId: z.string().min(1),
    seat: z.number().int().nonnegative(),
    amount: z
      .number()
      .int()
      .refine((n) => n !== 0, { message: 'amount must be non-zero' })
      .refine((n) => Math.abs(n) <= MAX_CHIP_TOTAL, {
        message: 'amount out of range',
      }),
  })
  .strict();

export const playerActSchema = z
  .object({
    roomId: z.string().min(1),
    action: z.enum(['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN']),
    // Only the raise/bet amount is taken from the client; chips/pot are never.
    amount: z.number().int().positive().optional(),
  })
  .strict();

// Player-showdown claim (mode B, task 6.1). Carries only the roomId and the
// claim verb; the claiming player (seat / user) is always the authenticated
// session user, NEVER the payload (IDOR). This validates shape only —
// authorization (active player, self, showdown mode, awaiting_showdown) is
// enforced in the use-case in a later PR, not here.
export const playerClaimSchema = z
  .object({
    roomId: z.string().min(1),
    claim: z.enum(['win', 'muck']),
  })
  .strict();

export type CreateRoomPayload = z.infer<typeof createRoomSchema>;
export type JoinRoomPayload = z.infer<typeof joinRoomSchema>;
export type LeaveRoomPayload = z.infer<typeof leaveRoomSchema>;
export type SitOutPayload = z.infer<typeof sitOutSchema>;
export type SitInPayload = z.infer<typeof sitInSchema>;
export type ResyncRoomPayload = z.infer<typeof resyncRoomSchema>;
export type RoomsMinePayload = z.infer<typeof roomsMineSchema>;
export type HistoryMinePayload = z.infer<typeof historyMineSchema>;
export type HandStartPayload = z.infer<typeof handStartSchema>;
export type AdvanceStreetPayload = z.infer<typeof advanceStreetSchema>;
export type ResetHandPayload = z.infer<typeof resetHandSchema>;
export type TurnRequestTimePayload = z.infer<typeof turnRequestTimeSchema>;
export type ChipsRequestPayload = z.infer<typeof chipsRequestSchema>;
export type ChipsApprovePayload = z.infer<typeof chipsApproveSchema>;
export type ChipsRejectPayload = z.infer<typeof chipsRejectSchema>;
export type AdjustChipsPayload = z.infer<typeof adjustChipsSchema>;
export type HandSettlePayload = z.infer<typeof handSettleSchema>;
export type EndGamePayload = z.infer<typeof endGameSchema>;
export type PlayerActPayload = z.infer<typeof playerActSchema>;
export type PlayerClaimPayload = z.infer<typeof playerClaimSchema>;
