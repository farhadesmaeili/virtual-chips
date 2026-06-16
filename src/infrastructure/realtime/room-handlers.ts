import type { CreateRoom, JoinRoom, LeaveRoom } from '@/application/use-cases';
import { isDomainError } from '@/domain/errors';
import { toPublicRoomState } from './room-projection';
import { createRoomSchema, joinRoomSchema, leaveRoomSchema } from './schemas';
import type { AppServer, AppSocket } from './socket-auth';

export interface RoomHandlerDeps {
  readonly createRoom: CreateRoom;
  readonly joinRoom: JoinRoom;
  readonly leaveRoom: LeaveRoom;
}

function emitError(socket: AppSocket, code: string, message: string): void {
  socket.emit('error', { code, message });
}

function handleError(socket: AppSocket, error: unknown): void {
  if (isDomainError(error)) {
    emitError(socket, error.code, error.message);
    return;
  }
  // Never leak internals for unexpected errors.
  emitError(socket, 'INTERNAL', 'Internal error');
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
}
