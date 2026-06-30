import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaSettlementRepository } from './prisma-settlement-repository';

/**
 * Unit-level coverage without a database: a stub PrismaClient records the
 * createMany payload so we can assert each settlement is written with its
 * gameId, userId and net.
 */
describe('PrismaSettlementRepository.saveForGame', () => {
  it('writes one row per settlement with the gameId attached', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const prisma = { settlement: { createMany } } as unknown as PrismaClient;

    const repo = new PrismaSettlementRepository(prisma);
    await repo.saveForGame('game-1', [
      { userId: 'alice', net: 800 },
      { userId: 'bob', net: -800 },
    ]);

    // net is written as bigint (the column is BigInt) — proves write conversion.
    expect(createMany).toHaveBeenCalledWith({
      data: [
        { gameId: 'game-1', userId: 'alice', net: 800n },
        { gameId: 'game-1', userId: 'bob', net: -800n },
      ],
    });
  });

  it('writes nothing when there are no settlements', async () => {
    const createMany = vi.fn();
    const prisma = { settlement: { createMany } } as unknown as PrismaClient;

    const repo = new PrismaSettlementRepository(prisma);
    await repo.saveForGame('game-1', []);

    expect(createMany).not.toHaveBeenCalled();
  });
});

describe('PrismaSettlementRepository.listForUser', () => {
  it('queries finished games only for the user, newest first', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { settlement: { findMany } } as unknown as PrismaClient;

    const repo = new PrismaSettlementRepository(prisma);
    await repo.listForUser('alice');

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 'alice', game: { endedAt: { not: null } } },
      orderBy: { game: { endedAt: 'desc' } },
      include: {
        game: {
          select: {
            id: true,
            endedAt: true,
            room: { select: { name: true } },
          },
        },
      },
    });
  });

  it('maps each row to the UserGameSettlement shape', async () => {
    const endedAt = new Date('2026-06-28T00:00:00.000Z');
    // The real Prisma client returns net as bigint; the stub mirrors that.
    const findMany = vi.fn().mockResolvedValue([
      {
        net: 800n,
        game: { id: 'game-1', endedAt, room: { name: 'Friday game' } },
      },
    ]);
    const prisma = { settlement: { findMany } } as unknown as PrismaClient;

    const repo = new PrismaSettlementRepository(prisma);
    const history = await repo.listForUser('alice');

    // net comes back as number — proves read conversion at the boundary.
    expect(history).toEqual([
      { gameId: 'game-1', net: 800, roomName: 'Friday game', endedAt },
    ]);
  });
});
