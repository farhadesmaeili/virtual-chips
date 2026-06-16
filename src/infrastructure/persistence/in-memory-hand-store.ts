import type { HandStore } from '@/application/ports';
import type { Hand } from '@/domain/entities';

/** In-memory implementation of {@link HandStore} (one live hand per room). */
export class InMemoryHandStore implements HandStore {
  private readonly hands = new Map<string, Hand>();

  async get(roomId: string): Promise<Hand | null> {
    return this.hands.get(roomId) ?? null;
  }

  async save(roomId: string, hand: Hand): Promise<void> {
    this.hands.set(roomId, hand);
  }

  async clear(roomId: string): Promise<void> {
    this.hands.delete(roomId);
  }
}
