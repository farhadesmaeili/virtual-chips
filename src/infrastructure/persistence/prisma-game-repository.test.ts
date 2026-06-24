import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaGameRepository } from './prisma-game-repository';

/**
 * Unit-level coverage for the new query without a database: a stub PrismaClient
 * records the `where` filter and returns a canned row, so we can assert
 * findOpenByRoom selects the open game (`endedAt: null`) and maps it.
 */
describe('PrismaGameRepository.findOpenByRoom', () => {
  it('queries the open game by room (endedAt: null) and maps the row', async () => {
    const row = {
      id: 'game-1',
      roomId: 'r1',
      startedAt: new Date('2026-01-01T00:00:00Z'),
      endedAt: null,
    };
    const findFirst = vi.fn().mockResolvedValue(row);
    const prisma = { game: { findFirst } } as unknown as PrismaClient;

    const repo = new PrismaGameRepository(prisma);
    const game = await repo.findOpenByRoom('r1');

    expect(findFirst).toHaveBeenCalledWith({
      where: { roomId: 'r1', endedAt: null },
    });
    expect(game).toEqual(row);
  });

  it('returns null when the room has no open game', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const prisma = { game: { findFirst } } as unknown as PrismaClient;

    const repo = new PrismaGameRepository(prisma);

    expect(await repo.findOpenByRoom('r1')).toBeNull();
  });
});
