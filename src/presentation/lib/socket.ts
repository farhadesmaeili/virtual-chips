import { io, type Socket } from 'socket.io-client';

// A single shared connection to the realtime server. The browser sends the
// NextAuth session cookie with the handshake (same-origin), so the server
// authenticates the connection (see infrastructure/realtime/socket-auth).
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket === null) {
    socket = io({ autoConnect: false });
  }
  return socket;
}
