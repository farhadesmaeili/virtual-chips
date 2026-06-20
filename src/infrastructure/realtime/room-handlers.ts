import type {
  CreateRoom,
  JoinRoom,
  LeaveRoom,
  ResyncRoom,
} from '@/application/use-cases';
import { toPublicHandState } from './hand-projection';
import type { RateLimiter } from './rate-limiter';
import { toPublicChipRequest, toPublicRoomState } from './room-projection';
import {
  createRoomSchema,
  joinRoomSchema,
  leaveRoomSchema,
  resyncRoomSchema,
} from './schemas';
import { emitError, handleError } from './socket-errors';
import type { AppServer, AppSocket } from './socket-auth';

export interface RoomHandlerDeps {
  readonly createRoom: CreateRoom;
  readonly joinRoom: JoinRoom;
  readonly leaveRoom: LeaveRoom;
  readonly resyncRoom: ResyncRoom;
  /** Rate limiter for the expensive room:create action. */
  readonly createLimiter: RateLimiter;
}

/**
 * Binds the room lifecycle events for an authenticated socket
 * (docs/REALTIME-EVENTS.md). The acting user is taken from the authenticated
 * socket, never from the payload. Each change broadcasts the public room
 * state to everyone in the room.
 */
export function registerRoomHandlers(
  io: AppServer,
  socket: AppSocket,
  deps: RoomHandlerDeps,
): void {
  const userId = socket.data.user.id;

  socket.on('room:create', (payload: unknown) => {
    void (async () => {
      const parsed = createRoomSchema.safeParse(payload);
      if (!parsed.success) {
        emitError(socket, 'INVALID_PAYLOAD', 'Invalid room:create payload');
        return;
      }
      if (!deps.createLimiter.tryAcquire(userId)) {
        emitError(socket, 'RATE_LIMITED', 'Too many rooms created; slow down');
        return;
      }
      try {
        const snapshot = await deps.createRoom.execute({
          bankerId: userId,
          name: parsed.data.name,
          settings: parsed.data.settings,
        });
        await socket.join(snapshot.id);
        io.to(snapshot.id).emit('room:state', toPublicRoomState(snapshot));
      } catch (error) {
        handleError(socket, error);
      }
    })();
  });

  socket.on('room:join', (payload: unknown) => {
    void (async () => {
      const parsed = joinRoomSchema.safeParse(payload);
      if (!parsed.success) {
        emitError(socket, 'INVALID_PAYLOAD', 'Invalid room:join payload');
        return;
      }
      try {
        const snapshot = await deps.joinRoom.execute({
          userId,
          roomId: parsed.data.roomId,
        });
        await socket.join(snapshot.id);
        io.to(snapshot.id).emit('room:state', toPublicRoomState(snapshot));
      } catch (error) {
        handleError(socket, error);
      }
    })();
  });

  socket.on('room:leave', (payload: unknown) => {
    void (async () => {
      const parsed = leaveRoomSchema.safeParse(payload);
      if (!parsed.success) {
        emitError(socket, 'INVALID_PAYLOAD', 'Invalid room:leave payload');
        return;
      }
      try {
        const snapshot = await deps.leaveRoom.execute({
          userId,
          roomId: parsed.data.roomId,
        });
        await socket.leave(parsed.data.roomId);
        const state = toPublicRoomState(snapshot);
        // Update the remaining members, and ack the leaver.
        io.to(snapshot.id).emit('room:state', state);
        socket.emit('room:state', state);
      } catch (error) {
        handleError(socket, error);
      }
    })();
  });

  // Reconnect: re-join the socket.io room and send the current snapshots to
  // this socket only, so the client resumes without losing state. The hand
  // state carries the current actionDeadline, so the countdown continues from
  // where it is (not from the start).
  socket.on('room:resync', (payload: unknown) => {
    void (async () => {
      const parsed = resyncRoomSchema.safeParse(payload);
      if (!parsed.success) {
        emitError(socket, 'INVALID_PAYLOAD', 'Invalid room:resync payload');
        return;
      }
      try {
        const { snapshot, hand, chipRequests } = await deps.resyncRoom.execute({
          userId,
          roomId: parsed.data.roomId,
        });
        await socket.join(snapshot.id);
        socket.emit('room:state', toPublicRoomState(snapshot));
        if (hand !== null) {
          socket.emit('hand:state', toPublicHandState(hand));
        }
        socket.emit('chips:requests', {
          requests: chipRequests.map(toPublicChipRequest),
        });
      } catch (error) {
        handleError(socket, error);
      }
    })();
  });
}
