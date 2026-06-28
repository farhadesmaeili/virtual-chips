import type { PrismaClient } from '@prisma/client';
import type {
  SettlementRecordInput,
  SettlementRepository,
  UserGameSettlement,
} from '@/application/ports';

export class PrismaSettlementRepository implements SettlementRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async saveForGame(
    gameId: string,
    settlements: readonly SettlementRecordInput[],
  ): Promise<void> {
    if (settlements.length === 0) return;
    await this.prisma.settlement.createMany({
      data: settlements.map((s) => ({
        gameId,
        userId: s.userId,
        net: s.net,
      })),
    });
  }

  async listForUser(userId: string): Promise<UserGameSettlement[]> {
    const rows = await this.prisma.settlement.findMany({
      where: { userId, game: { endedAt: { not: null } } },
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
    return rows.map((r) => ({
      gameId: r.game.id,
      net: r.net,
      roomName: r.game.room.name,
      // endedAt non-null guaranteed by the where filter.
      endedAt: r.game.endedAt as Date,
    }));
  }
}
