import { PrismaClient, type User } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Development seed. Idempotent: safe to run repeatedly — it upserts by unique
 * keys, never creating duplicates. Run with `pnpm db:seed`.
 *
 * All seeded users share this password so they are login-ready once the
 * credentials auth lands (task 2.3 must verify with bcrypt).
 */
const DEV_PASSWORD = 'password123';
const DEV_ROOM_ID = 'dev-room';

const USER_SEEDS = [
  { email: 'alice@example.com', username: 'alice' },
  { email: 'bob@example.com', username: 'bob' },
  { email: 'carol@example.com', username: 'carol' },
] as const;

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  const users: Record<string, User> = {};
  for (const seed of USER_SEEDS) {
    users[seed.username] = await prisma.user.upsert({
      where: { email: seed.email },
      // Leave existing users untouched (don't churn the password hash on re-run).
      update: {},
      create: {
        email: seed.email,
        username: seed.username,
        password: passwordHash,
      },
    });
  }

  const banker = users.alice;
  if (banker === undefined) {
    throw new Error('seed invariant: banker user was not created');
  }

  const room = await prisma.room.upsert({
    where: { id: DEV_ROOM_ID },
    update: {
      name: 'Dev Table',
      bankerId: banker.id,
      smallBlind: 5,
      bigBlind: 10,
    },
    create: {
      id: DEV_ROOM_ID,
      name: 'Dev Table',
      bankerId: banker.id,
      smallBlind: 5,
      bigBlind: 10,
    },
  });

  const memberSeeds = [
    { username: 'alice', seat: 0, buyInTotal: 1000, chips: 1000 },
    { username: 'bob', seat: 1, buyInTotal: 1000, chips: 1000 },
    { username: 'carol', seat: 2, buyInTotal: 500, chips: 500 },
  ] as const;

  for (const m of memberSeeds) {
    const user = users[m.username];
    if (user === undefined) continue;
    await prisma.roomMember.upsert({
      where: { roomId_userId: { roomId: room.id, userId: user.id } },
      // Reset to known seed values so re-running gives a deterministic state.
      update: { seat: m.seat, buyInTotal: m.buyInTotal, chips: m.chips },
      create: {
        roomId: room.id,
        userId: user.id,
        seat: m.seat,
        buyInTotal: m.buyInTotal,
        chips: m.chips,
      },
    });
  }

  console.info(
    `Seeded ${USER_SEEDS.length} users and room "${room.name}" (${DEV_ROOM_ID}) with ${memberSeeds.length} members.`,
  );
  console.info(`Dev login password for all seeded users: ${DEV_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
