import { isDomainError } from '@/domain/errors';
import type { AppSocket } from './socket-auth';

export function emitError(
  socket: AppSocket,
  code: string,
  message: string,
): void {
  socket.emit('error', { code, message });
}

/** Maps a thrown error to an `error` event, never leaking internals. */
export function handleError(socket: AppSocket, error: unknown): void {
  if (isDomainError(error)) {
    emitError(socket, error.code, error.message);
    return;
  }
  emitError(socket, 'INTERNAL', 'Internal error');
}
