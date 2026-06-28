import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { parse } from 'node:url';
import { loadEnvConfig } from '@next/env';
import next from 'next';
import { Server, type DefaultEventsMap } from 'socket.io';
import type { Clock, IdGenerator } from './src/application/ports';
import {
  AdjustMemberChips,
  AdvanceStreet,
  ApproveChipRequest,
  CreateRoom,
  EndGame,
  JoinRoom,
  LeaveRoom,
  ListUserGameHistory,
  ListUserRooms,
  PlayerAct,
  RecordClaim,
  RejectChipRequest,
  RequestChips,
  RequestTimeExtension,
  ResetHand,
  ResyncRoom,
  SettleHand,
  SitIn,
  SitOut,
  StartHand,
} from './src/application/use-cases';
import { InMemoryChipRequestStore } from './src/infrastructure/persistence/in-memory-chip-request-store';
import { InMemoryHandStore } from './src/infrastructure/persistence/in-memory-hand-store';
import { prisma } from './src/infrastructure/persistence/prisma';
import { PrismaGameRepository } from './src/infrastructure/persistence/prisma-game-repository';
import { PrismaRoomRepository } from './src/infrastructure/persistence/prisma-room-repository';
import { PrismaSettlementRepository } from './src/infrastructure/persistence/prisma-settlement-repository';
import { registerFundingHandlers } from './src/infrastructure/realtime/funding-handlers';
import { HandGateway } from './src/infrastructure/realtime/hand-gateway';
import { registerHandHandlers } from './src/infrastructure/realtime/hand-handlers';
import {
  CHIP_REQUEST_LIMIT,
  PLAYER_ACT_LIMIT,
  ROOM_CREATE_LIMIT,
  TokenBucketRateLimiter,
} from './src/infrastructure/realtime/rate-limiter';
import { registerRoomHandlers } from './src/infrastructure/realtime/room-handlers';
import {
  createSocketAuthMiddleware,
  type AppSocket,
  type SocketData,
} from './src/infrastructure/realtime/socket-auth';

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT ?? '3000');
// Bind to all interfaces so the dev server is reachable from other devices on
// the LAN (e.g. a phone on the same Wi-Fi). Override with HOST if needed.
const host = process.env.HOST ?? '0.0.0.0';

/** Non-internal IPv4 addresses of this machine, for the "open on your phone" hint. */
function lanAddresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const ni of list ?? []) {
      // Node may report `family` as 'IPv4' (string) or 4 (number) across versions.
      const isIPv4 = ni.family === 'IPv4' || (ni.family as unknown) === 4;
      if (isIPv4 && !ni.internal) out.push(ni.address);
    }
  }
  return out;
}

async function main(): Promise<void> {
  // A standalone server does not get Next's automatic .env loading until later;
  // load it explicitly so server-side env (e.g. NEXTAUTH_SECRET, DATABASE_URL)
  // is available before anything reads it.
  loadEnvConfig(process.cwd());

  // Dev convenience: a NEXTAUTH_URL pinned to localhost breaks auth when the app
  // is opened from another device by LAN IP (NextAuth validates/redirects against
  // that origin). In dev we drop a localhost value so NextAuth infers the origin
  // per-request from the Host header — working for both localhost and the LAN IP.
  // Never touched in production, where NEXTAUTH_URL must be set explicitly.
  if (dev) {
    const url = process.env.NEXTAUTH_URL;
    if (
      url !== undefined &&
      /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url)
    ) {
      delete process.env.NEXTAUTH_URL;
    }
  }

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

  // Compose the use-cases over the repositories (composition root).
  const roomRepository = new PrismaRoomRepository(prisma);
  const gameRepository = new PrismaGameRepository(prisma);
  const settlementRepository = new PrismaSettlementRepository(prisma);
  const handStore = new InMemoryHandStore();
  const chipRequestStore = new InMemoryChipRequestStore();
  const idGenerator: IdGenerator = { generate: () => randomUUID() };
  const clock: Clock = { now: () => Date.now() };
  const createLimiter = new TokenBucketRateLimiter(ROOM_CREATE_LIMIT, clock);
  const actLimiter = new TokenBucketRateLimiter(PLAYER_ACT_LIMIT, clock);
  const chipRequestLimiter = new TokenBucketRateLimiter(
    CHIP_REQUEST_LIMIT,
    clock,
  );
  const roomHandlerDeps = {
    createRoom: new CreateRoom(roomRepository, idGenerator),
    joinRoom: new JoinRoom(roomRepository),
    leaveRoom: new LeaveRoom(roomRepository, handStore),
    sitOut: new SitOut(roomRepository),
    sitIn: new SitIn(roomRepository),
    resyncRoom: new ResyncRoom(roomRepository, handStore, chipRequestStore),
    listUserRooms: new ListUserRooms(roomRepository),
    listUserGameHistory: new ListUserGameHistory(settlementRepository),
    createLimiter,
  };
  const fundingHandlerDeps = {
    requestChips: new RequestChips(
      roomRepository,
      chipRequestStore,
      idGenerator,
      clock,
    ),
    approveChipRequest: new ApproveChipRequest(
      roomRepository,
      chipRequestStore,
    ),
    rejectChipRequest: new RejectChipRequest(roomRepository, chipRequestStore),
    adjustMemberChips: new AdjustMemberChips(roomRepository, handStore),
    requestLimiter: chipRequestLimiter,
  };
  const handGateway = new HandGateway(
    io,
    new StartHand(
      roomRepository,
      handStore,
      idGenerator,
      clock,
      gameRepository,
    ),
    new PlayerAct(roomRepository, handStore, clock),
    new AdvanceStreet(roomRepository, handStore, clock),
    new ResetHand(roomRepository, handStore, idGenerator, clock),
    new SettleHand(roomRepository, handStore),
    new RecordClaim(roomRepository, handStore),
    new RequestTimeExtension(handStore, clock),
    new EndGame(
      roomRepository,
      handStore,
      gameRepository,
      settlementRepository,
    ),
    handStore,
    roomRepository,
  );

  io.on('connection', (socket: AppSocket) => {
    const { user } = socket.data;
    console.info(
      `socket connected: ${socket.id} as ${user.username} (${user.id})`,
    );
    // Connection acknowledgement so the client knows auth succeeded.
    socket.emit('session:ready', { user });

    registerRoomHandlers(io, socket, roomHandlerDeps);
    registerHandHandlers(socket, { gateway: handGateway, actLimiter });
    registerFundingHandlers(io, socket, fundingHandlerDeps);

    // Clear a room's turn timer when its last member disconnects (no zombies).
    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room === socket.id) continue;
        const size = io.sockets.adapter.rooms.get(room)?.size ?? 0;
        if (size <= 1) handGateway.clear(room);
      }
    });

    socket.on('disconnect', (reason) => {
      console.info(`socket disconnected: ${socket.id} (${reason})`);
    });
  });

  httpServer.listen(port, host, () => {
    console.info(`> Server ready on http://localhost:${port}`);
    if (dev) {
      for (const ip of lanAddresses()) {
        console.info(`> On your network:  http://${ip}:${port}`);
      }
      console.info('> Open a network URL on your phone (same Wi-Fi) to test.');
    }
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
