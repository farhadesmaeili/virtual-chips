import type { Clock, HandStore } from '@/application/ports';
import type { Hand } from '@/domain/entities';
import { extendDeadline, TIME_EXTENSION_MS } from '@/domain/engine';
import { InvalidActionError, NoActiveHandError } from '@/domain/errors';

export interface RequestTimeExtensionInput {
  readonly roomId: string;
  readonly userId: string;
}

/**
 * Grants the acting player a time-bank extension (task 4.12). Thin I/O around
 * the pure {@link extendDeadline}: the identity comes from the authenticated
 * user (mapped to their seat), never the payload. The engine re-validates that
 * it is their turn, a turn is pending, and budget remains.
 */
export class RequestTimeExtension {
  constructor(
    private readonly hands: HandStore,
    private readonly clock: Clock,
  ) {}

  async execute({ roomId, userId }: RequestTimeExtensionInput): Promise<Hand> {
    const hand = await this.hands.get(roomId);
    if (hand === null) throw new NoActiveHandError(roomId);

    const player = hand.players.find((p) => p.userId === userId);
    if (player === undefined) {
      throw new InvalidActionError('you are not in this hand');
    }

    const extended = extendDeadline(
      hand,
      player.seat,
      TIME_EXTENSION_MS,
      this.clock.now(),
    );
    await this.hands.save(roomId, extended);
    return extended;
  }
}
