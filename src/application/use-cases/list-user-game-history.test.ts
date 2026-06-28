import { describe, expect, it } from 'vitest';
import type {
  SettlementRecordInput,
  SettlementRepository,
  UserGameSettlement,
} from '@/application/ports';
import { ListUserGameHistory } from './list-user-game-history';

/**
 * In-memory SettlementRepository: each stored row carries its userId so we can
 * assert `listForUser` only ever returns the requesting user's rows (IDOR). The
 * save path is unused here but kept to satisfy the port.
 */
class FakeSettlementRepository implements SettlementRepository {
  private readonly rows: (UserGameSettlement & { userId: string })[] = [];

  add(row: UserGameSettlement & { userId: string }): void {
    this.rows.push(row);
  }

  async saveForGame(
    _gameId: string,
    _settlements: readonly SettlementRecordInput[],
  ): Promise<void> {
    // Not exercised by these tests.
  }

  async listForUser(userId: string): Promise<UserGameSettlement[]> {
    return this.rows
      .filter((r) => r.userId === userId)
      .map(({ userId: _userId, ...rest }) => rest);
  }
}

function settlement(
  userId: string,
  gameId: string,
  net: number,
): UserGameSettlement & { userId: string } {
  return {
    userId,
    gameId,
    net,
    roomName: `room-${gameId}`,
    endedAt: new Date('2026-06-28T00:00:00.000Z'),
  };
}

describe('ListUserGameHistory', () => {
  it('returns the finished-game settlements for the requesting user', async () => {
    const repo = new FakeSettlementRepository();
    repo.add(settlement('alice', 'game-1', 800));
    repo.add(settlement('alice', 'game-2', -300));

    const history = await new ListUserGameHistory(repo).execute({
      userId: 'alice',
    });

    expect(history.map((h) => h.gameId)).toEqual(['game-1', 'game-2']);
    expect(history.map((h) => h.net)).toEqual([800, -300]);
  });

  it('returns an empty array when the user has no settlements', async () => {
    const repo = new FakeSettlementRepository();
    repo.add(settlement('alice', 'game-1', 800));

    const history = await new ListUserGameHistory(repo).execute({
      userId: 'nobody',
    });

    expect(history).toEqual([]);
  });

  it("returns only the requester's own settlements, never another user's (IDOR)", async () => {
    // alice and bob played the same game; each must see only their own row —
    // a user must never read another user's settlement.
    const repo = new FakeSettlementRepository();
    repo.add(settlement('alice', 'game-1', 800));
    repo.add(settlement('bob', 'game-1', -800));

    const aliceHistory = await new ListUserGameHistory(repo).execute({
      userId: 'alice',
    });
    const bobHistory = await new ListUserGameHistory(repo).execute({
      userId: 'bob',
    });

    expect(aliceHistory.map((h) => h.net)).toEqual([800]);
    expect(bobHistory.map((h) => h.net)).toEqual([-800]);
    // bob's loss must never surface for alice.
    expect(aliceHistory.map((h) => h.net)).not.toContain(-800);
  });
});
