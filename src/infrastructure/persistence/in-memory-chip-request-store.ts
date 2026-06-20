import type { ChipRequest, ChipRequestStore } from '@/application/ports';

/** In-memory {@link ChipRequestStore} — pending buy-in requests per room. */
export class InMemoryChipRequestStore implements ChipRequestStore {
  private readonly byId = new Map<string, ChipRequest>();

  async add(request: ChipRequest): Promise<void> {
    this.byId.set(request.id, request);
  }

  async get(id: string): Promise<ChipRequest | null> {
    return this.byId.get(id) ?? null;
  }

  async remove(id: string): Promise<void> {
    this.byId.delete(id);
  }

  async listByRoom(roomId: string): Promise<ChipRequest[]> {
    return [...this.byId.values()]
      .filter((r) => r.roomId === roomId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async hasPending(roomId: string, userId: string): Promise<boolean> {
    for (const r of this.byId.values()) {
      if (r.roomId === roomId && r.userId === userId) return true;
    }
    return false;
  }
}
