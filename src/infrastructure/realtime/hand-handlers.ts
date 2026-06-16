import type { PlayerAct, StartHand } from '@/application/use-cases';
import { toPublicHandState } from './hand-projection';
import { handStartSchema, playerActSchema } from './schemas';
import { emitError, handleError } from './socket-errors';
import type { AppServer, AppSocket } from './socket-auth';

export interface HandHandlerDeps {
  readonly startHand: StartHand;
  readonly playerAct: PlayerAct;
}

/**
 * Binds the hand/betting events for an authenticated socket
 * (docs/REALTIME-EVENTS.md). The acting user comes from the socket; banker and
 * turn checks live in the use-cases and the pure engine.
 */
export function registerHandHandlers(
  io: AppServer,
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
        const hand = await deps.startHand.execute({
          roomId: parsed.data.roomId,
          requesterId: userId,
        });
        const state = toPublicHandState(hand);
        io.to(parsed.data.roomId).emit('hand:state', state);
        io.to(parsed.data.roomId).emit('turn:changed', {
          actingSeat: state.actingSeat,
          actionDeadline: state.actionDeadline,
        });
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
        const { hand, applied } = await deps.playerAct.execute({
          roomId: parsed.data.roomId,
          userId,
          action: { type: parsed.data.action, amount: parsed.data.amount },
        });
        const state = toPublicHandState(hand);
        const room = parsed.data.roomId;
        io.to(room).emit('action:applied', {
          seat: applied.seat,
          action: applied.type,
          amount: applied.amount ?? null,
        });
        io.to(room).emit('hand:state', state);
        io.to(room).emit('turn:changed', {
          actingSeat: state.actingSeat,
          actionDeadline: state.actionDeadline,
        });
        io.to(room).emit('pot:updated', { pots: state.pots });
      } catch (error) {
        handleError(socket, error);
      }
    })();
  });
}
