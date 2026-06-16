import type { HandGateway } from './hand-gateway';
import { handStartSchema, playerActSchema } from './schemas';
import { emitError, handleError } from './socket-errors';
import type { AppSocket } from './socket-auth';

export interface HandHandlerDeps {
  readonly gateway: HandGateway;
}

/**
 * Binds the hand/betting events for an authenticated socket
 * (docs/REALTIME-EVENTS.md). The acting user comes from the socket; banker,
 * turn checks, broadcasting and the turn timer live in the gateway / engine.
 */
export function registerHandHandlers(
  socket: AppSocket,
  deps: HandHandlerDeps,
): void {
  const userId = socket.data.user.id;

  socket.on('hand:start', (payload: unknown) => {
    void (async () => {
      const parsed = handStartSchema.safeParse(payload);
      if (!parsed.success) {
        emitError(socket, 'INVALID_PAYLOAD', 'Invalid hand:start payload');
        return;
      }
      try {
        await deps.gateway.start(parsed.data.roomId, userId);
      } catch (error) {
        handleError(socket, error);
      }
    })();
  });

  socket.on('player:act', (payload: unknown) => {
    void (async () => {
      const parsed = playerActSchema.safeParse(payload);
      if (!parsed.success) {
        emitError(socket, 'INVALID_PAYLOAD', 'Invalid player:act payload');
        return;
      }
      try {
        await deps.gateway.act(parsed.data.roomId, userId, {
          type: parsed.data.action,
          amount: parsed.data.amount,
        });
      } catch (error) {
        handleError(socket, error);
      }
    })();
  });
}
