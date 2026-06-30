import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaRoomRepository } from './prisma-room-repository';

/**
 * Unit-level coverage without a database: a stub PrismaClient returns member
 * rows whose chip columns are bigint (as the real client does once the columns
 * are BigInt). The boundary must hand the application layer plain numbers.
 */
describe('PrismaRoomRepository chip boundary', () => {
  it('addMember returns chips/buyInTotal as number', async () => {
    const create = vi.fn().mockResolvedValue({
      userId: 'alice',
      user: { username: 'alice' },
      seat: 0,
      buyInTotal: 1000n,
      chips: 1000n,
      sittingOut: false,
    });
    const prisma = { roomMember: { create } } as unknown as PrismaClient;

    const repo = new PrismaRoomRepository(prisma);
    const member = await repo.addMember('room-1', {
      userId: 'alice',
      seat: 0,
      buyInTotal: 1000,
      chips: 1000,
    });

    expect(typeof member.chips).toBe('number');
    expect(typeof member.buyInTotal).toBe('number');
    expect(member.chips).toBe(1000);
    expect(member.buyInTotal).toBe(1000);
    // Written down as bigint (the column is BigInt).
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ chips: 1000n, buyInTotal: 1000n }),
      }),
    );
  });

  it('listMembers returns chips/buyInTotal as number', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        userId: 'alice',
        user: { username: 'alice' },
        seat: 0,
        buyInTotal: 3_000_000_000n,
        chips: 3_000_000_000n,
        sittingOut: false,
      },
    ]);
    const prisma = { roomMember: { findMany } } as unknown as PrismaClient;

    const repo = new PrismaRoomRepository(prisma);
    const members = await repo.listMembers('room-1');

    expect(members).toHaveLength(1);
    const [member] = members;
    expect(typeof member?.chips).toBe('number');
    expect(typeof member?.buyInTotal).toBe('number');
    // A value above int32 survives the boundary intact (the migration's point).
    expect(member?.chips).toBe(3_000_000_000);
    expect(member?.buyInTotal).toBe(3_000_000_000);
  });
});
