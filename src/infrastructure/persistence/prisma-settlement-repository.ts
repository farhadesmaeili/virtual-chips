import type { PrismaClient } from '@prisma/client';
import type {
  SettlementRecordInput,
  SettlementRepository,
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
}
