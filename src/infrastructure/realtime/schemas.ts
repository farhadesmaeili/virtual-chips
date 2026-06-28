import { z } from 'zod';

/** Zod schemas for socket payloads (docs/REALTIME-EVENTS.md). */

/** Sane upper bound for a blind so a typo can't open an absurd table. */
const MAX_BLIND = 1_000_000;

export const roomSettingsSchema = z
  .object({
    smallBlind: z.number().int().positive().max(MAX_BLIND).optional(),
    bigBlind: z.number().int().positive().max(MAX_BLIND).optional(),
    actionTimeoutMs: z.number().int().min(1000).optional(),
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
    amount: z.number().int().positive().max(1_000_000),
  })
  .strict();

export const chipsApproveSchema = z
  .object({ roomId: z.string().min(1), requestId: z.string().min(1) })
  .strict();

export const chipsRejectSchema = z
  .object({ roomId: z.string().min(1), requestId: z.string().min(1) })
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
export type HandSettlePayload = z.infer<typeof handSettleSchema>;
export type EndGamePayload = z.infer<typeof endGameSchema>;
export type PlayerActPayload = z.infer<typeof playerActSchema>;
export type PlayerClaimPayload = z.infer<typeof playerClaimSchema>;
