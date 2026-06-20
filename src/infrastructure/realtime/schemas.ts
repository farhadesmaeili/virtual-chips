import { z } from 'zod';

/** Zod schemas for socket payloads (docs/REALTIME-EVENTS.md). */

export const roomSettingsSchema = z
  .object({
    smallBlind: z.number().int().positive().optional(),
    bigBlind: z.number().int().positive().optional(),
    actionTimeoutMs: z.number().int().min(1000).optional(),
    settlementMode: z.enum(['banker', 'showdown']).optional(),
  })
  .strict();

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
export type HandSettlePayload = z.infer<typeof handSettleSchema>;
export type PlayerActPayload = z.infer<typeof playerActSchema>;
