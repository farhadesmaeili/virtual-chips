import type { Hand } from '@/domain/entities';

/**
 * Holds the current live hand per room. The betting engine is pure, so the
 * store just keeps the latest Hand snapshot between actions. (In-memory for
 * now; could move to Redis/DB later without changing the use-cases.)
 */
export interface HandStore {
  get(roomId: string): Promise<Hand | null>;
  save(roomId: string, hand: Hand): Promise<void>;
  clear(roomId: string): Promise<void>;
}
