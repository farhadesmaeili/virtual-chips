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

export const resyncRoomSchema = z
  .object({ roomId: z.string().min(1) })
  .strict();

export const handStartSchema = z.object({ roomId: z.string().min(1) }).strict();

export const advanceStreetSchema = z
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

export type CreateRoomPayload = z.infer<typeof createRoomSchema>;
export type JoinRoomPayload = z.infer<typeof joinRoomSchema>;
export type LeaveRoomPayload = z.infer<typeof leaveRoomSchema>;
export type ResyncRoomPayload = z.infer<typeof resyncRoomSchema>;
export type HandStartPayload = z.infer<typeof handStartSchema>;
export type AdvanceStreetPayload = z.infer<typeof advanceStreetSchema>;
export type ChipsRequestPayload = z.infer<typeof chipsRequestSchema>;
export type ChipsApprovePayload = z.infer<typeof chipsApproveSchema>;
export type ChipsRejectPayload = z.infer<typeof chipsRejectSchema>;
export type HandSettlePayload = z.infer<typeof handSettleSchema>;
export type PlayerActPayload = z.infer<typeof playerActSchema>;
