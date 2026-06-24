import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  GameRecord,
  GameRepository,
  SaveHandInput,
} from '@/application/ports';

export class PrismaGameRepository implements GameRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(roomId: string): Promise<GameRecord> {
    const game = await this.prisma.game.create({ data: { roomId } });
    return toGameRecord(game);
  }

  async findById(id: string): Promise<GameRecord | null> {
    const game = await this.prisma.game.findUnique({ where: { id } });
    return game === null ? null : toGameRecord(game);
  }

  async findOpenByRoom(roomId: string): Promise<GameRecord | null> {
    // At most one game per room is open at a time (endedAt: null), so the first
    // such row is the open game. See GameRepository.findOpenByRoom for the
    // lazy-on-first-hand lifecycle.
    const game = await this.prisma.game.findFirst({
      where: { roomId, endedAt: null },
    });
    return game === null ? null : toGameRecord(game);
  }

  async end(id: string): Promise<void> {
    await this.prisma.game.update({
      where: { id },
      data: { endedAt: new Date() },
    });
  }

  async saveHand(input: SaveHandInput): Promise<{ id: string }> {
    const hand = await this.prisma.hand.create({
      data: {
        gameId: input.gameId,
        state: input.state as Prisma.InputJsonValue,
      },
    });
    return { id: hand.id };
  }
}

function toGameRecord(game: {
  id: string;
  roomId: string;
  startedAt: Date;
  endedAt: Date | null;
}): GameRecord {
  return {
    id: game.id,
    roomId: game.roomId,
    startedAt: game.startedAt,
    endedAt: game.endedAt,
  };
}
