import type { HandGateway } from './hand-gateway';
import type { RateLimiter } from './rate-limiter';
import {
  advanceStreetSchema,
  handSettleSchema,
  handStartSchema,
  playerActSchema,
  turnRequestTimeSchema,
} from './schemas';
import { emitError, handleError } from './socket-errors';
import type { AppSocket } from './socket-auth';

export interface HandHandlerDeps {
  readonly gateway: HandGateway;
  /** Rate limiter for frequent player:act actions. */
  readonly actLimiter: RateLimiter;
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

  socket.on('hand:advance-street', (payload: unknown) => {
    void (async () => {
      const parsed = advanceStreetSchema.safeParse(payload);
      if (!parsed.success) {
        emitError(
          socket,
          'INVALID_PAYLOAD',
          'Invalid hand:advance-street payload',
        );
        return;
      }
      try {
        // Banker-only; the use-case enforces authorization.
        await deps.gateway.advanceStreetDeal(parsed.data.roomId, userId);
      } catch (error) {
        handleError(socket, error);
      }
    })();
  });

  socket.on('hand:settle', (payload: unknown) => {
    void (async () => {
      const parsed = handSettleSchema.safeParse(payload);
      if (!parsed.success) {
        emitError(socket, 'INVALID_PAYLOAD', 'Invalid hand:settle payload');
        return;
      }
      try {
        // Banker-only; the use-case enforces authorization.
        await deps.gateway.settle(
          parsed.data.roomId,
          userId,
          parsed.data.declarations,
        );
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
      // Server auto-actions go through the gateway directly, so they are never
      // rate-limited here — only client-initiated actions are.
      if (!deps.actLimiter.tryAcquire(userId)) {
        emitError(socket, 'RATE_LIMITED', 'Too many actions; slow down');
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

  // Time bank (task 4.12): the acting player asks for more time. The budget
  // already bounds this, but the limiter still stops a tight failing loop. The
  // gateway/use-case enforce turn + budget authorization server-side.
  socket.on('turn:request-time', (payload: unknown) => {
    void (async () => {
      const parsed = turnRequestTimeSchema.safeParse(payload);
      if (!parsed.success) {
        emitError(
          socket,
          'INVALID_PAYLOAD',
          'Invalid turn:request-time payload',
        );
        return;
      }
      if (!deps.actLimiter.tryAcquire(userId)) {
        emitError(socket, 'RATE_LIMITED', 'Too many actions; slow down');
        return;
      }
      try {
        await deps.gateway.requestTime(parsed.data.roomId, userId);
      } catch (error) {
        handleError(socket, error);
      }
    })();
  });
}
