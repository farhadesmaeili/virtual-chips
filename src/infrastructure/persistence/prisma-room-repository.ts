import type { PrismaClient } from '@prisma/client';
import type {
  AddMemberInput,
  RoomMemberRecord,
  RoomRepository,
} from '@/application/ports';
import type { Room, RoomStatus } from '@/domain/entities';
import {
  toDomainRoom,
  toPrismaRoomStatus,
  toPrismaSettlementMode,
} from './mappers';

export class PrismaRoomRepository implements RoomRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(room: Room): Promise<Room> {
    const created = await this.prisma.room.create({
      data: {
        id: room.id,
        name: room.name,
        bankerId: room.bankerId,
        status: toPrismaRoomStatus(room.status),
        actionTimeoutMs: room.settings.actionTimeoutMs,
        smallBlind: room.settings.smallBlind,
        bigBlind: room.settings.bigBlind,
        settlementMode: toPrismaSettlementMode(room.settings.settlementMode),
      },
    });
    return toDomainRoom(created);
  }

  async findById(id: string): Promise<Room | null> {
    const room = await this.prisma.room.findUnique({ where: { id } });
    return room === null ? null : toDomainRoom(room);
  }

  async updateStatus(id: string, status: RoomStatus): Promise<void> {
    await this.prisma.room.update({
      where: { id },
      data: { status: toPrismaRoomStatus(status) },
    });
  }

  async addMember(
    roomId: string,
    member: AddMemberInput,
  ): Promise<RoomMemberRecord> {
    const created = await this.prisma.roomMember.create({
      data: {
        roomId,
        userId: member.userId,
        seat: member.seat,
        buyInTotal: member.buyInTotal,
        chips: member.chips,
      },
    });
    return {
      userId: created.userId,
      seat: created.seat,
      buyInTotal: created.buyInTotal,
      chips: created.chips,
    };
  }

  async listMembers(roomId: string): Promise<RoomMemberRecord[]> {
    const members = await this.prisma.roomMember.findMany({
      where: { roomId },
      orderBy: { seat: 'asc' },
    });
    return members.map((m) => ({
      userId: m.userId,
      seat: m.seat,
      buyInTotal: m.buyInTotal,
      chips: m.chips,
    }));
  }
}
