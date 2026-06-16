import type { IncomingMessage } from 'node:http';
import { getToken, type JWT } from 'next-auth/jwt';
import type { DefaultEventsMap, Server, Socket } from 'socket.io';

/** The authenticated identity attached to a socket. */
export interface SocketUser {
  readonly id: string;
  readonly username: string;
}

/** Per-socket data populated by the auth middleware. */
export interface SocketData {
  user: SocketUser;
}

export type AppSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;

export type AppServer = Server<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;

/**
 * Parses a raw `Cookie` header into a name->value map. NextAuth's `getToken`
 * reads `req.cookies` (already parsed) rather than the raw header, and a
 * socket's handshake request only carries the raw header, so we parse it here.
 */
export function parseCookieHeader(
  header: string | undefined,
): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (header === undefined) return cookies;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name.length === 0) continue;
    cookies[name] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return cookies;
}

/**
 * Maps a decoded NextAuth JWT to a socket user, or null if it is not a valid
 * session. Pure and defensive: a missing or malformed token yields null.
 */
export function socketUserFromToken(token: JWT | null): SocketUser | null {
  if (token === null) return null;
  const id: unknown = token.id;
  if (typeof id !== 'string' || id.length === 0) return null;
  const username = typeof token.username === 'string' ? token.username : '';
  return { id, username };
}

/**
 * Socket.io middleware that authenticates a connection from the NextAuth
 * session cookie (sent with the handshake). Anonymous or invalid connections
 * are rejected, so unauthenticated sockets never reach the room handlers.
 */
export function createSocketAuthMiddleware(
  secret: string | undefined = process.env.NEXTAUTH_SECRET,
) {
  return async (
    socket: AppSocket,
    next: (err?: Error) => void,
  ): Promise<void> => {
    try {
      // Attach the parsed cookies so getToken can read the session cookie from
      // the handshake request.
      const req = Object.assign(socket.request, {
        cookies: parseCookieHeader(socket.request.headers.cookie),
      }) as IncomingMessage & { cookies: Record<string, string> };
      const token = await getToken({ req, secret });
      const user = socketUserFromToken(token);
      if (user === null) {
        next(new Error('unauthorized'));
        return;
      }
      socket.data.user = user;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  };
}
