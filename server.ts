import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { parse } from 'node:url';
import { loadEnvConfig } from '@next/env';
import next from 'next';
import { Server, type DefaultEventsMap } from 'socket.io';
import type { IdGenerator } from './src/application/ports';
import { CreateRoom, JoinRoom, LeaveRoom } from './src/application/use-cases';
import { prisma } from './src/infrastructure/persistence/prisma';
import { PrismaRoomRepository } from './src/infrastructure/persistence/prisma-room-repository';
import { registerRoomHandlers } from './src/infrastructure/realtime/room-handlers';
import {
  createSocketAuthMiddleware,
  type AppSocket,
  type SocketData,
} from './src/infrastructure/realtime/socket-auth';

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT ?? '3000');

async function main(): Promise<void> {
  // A standalone server does not get Next's automatic .env loading until later;
  // load it explicitly so server-side env (e.g. NEXTAUTH_SECRET, DATABASE_URL)
  // is available before anything reads it.
  loadEnvConfig(process.cwd());

  const app = next({ dev });
  const handle = app.getRequestHandler();
  await app.prepare();

  const httpServer = createServer((req, res) => {
    void handle(req, res, parse(req.url ?? '', true));
  });

  const io = new Server<
    DefaultEventsMap,
    DefaultEventsMap,
    DefaultEventsMap,
    SocketData
  >(httpServer);

  // Authenticate every connection from the NextAuth session cookie.
  io.use(createSocketAuthMiddleware());

  // Compose the room use-cases over the Prisma repositories (composition root).
  const roomRepository = new PrismaRoomRepository(prisma);
  const idGenerator: IdGenerator = { generate: () => randomUUID() };
  const roomHandlerDeps = {
    createRoom: new CreateRoom(roomRepository, idGenerator),
    joinRoom: new JoinRoom(roomRepository),
    leaveRoom: new LeaveRoom(roomRepository),
  };

  io.on('connection', (socket: AppSocket) => {
    const { user } = socket.data;
    console.info(
      `socket connected: ${socket.id} as ${user.username} (${user.id})`,
    );
    // Connection acknowledgement so the client knows auth succeeded.
    socket.emit('session:ready', { user });

    registerRoomHandlers(io, socket, roomHandlerDeps);

    socket.on('disconnect', (reason) => {
      console.info(`socket disconnected: ${socket.id} (${reason})`);
    });
  });

  httpServer.listen(port, () => {
    console.info(`> Server ready on http://localhost:${port}`);
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
