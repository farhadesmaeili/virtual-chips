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

    expect(createMany).toHaveBeenCalledWith({
      data: [
        { gameId: 'game-1', userId: 'alice', net: 800 },
        { gameId: 'game-1', userId: 'bob', net: -800 },
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
