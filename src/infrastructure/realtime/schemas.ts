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

export type CreateRoomPayload = z.infer<typeof createRoomSchema>;
export type JoinRoomPayload = z.infer<typeof joinRoomSchema>;
export type LeaveRoomPayload = z.infer<typeof leaveRoomSchema>;
