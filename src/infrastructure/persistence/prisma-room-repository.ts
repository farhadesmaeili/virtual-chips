import type { PrismaClient } from '@prisma/client';
import type {
  AddMemberInput,
  RoomMemberRecord,
  RoomRepository,
  UserRoomMembership,
} from '@/application/ports';
import type { Room, RoomStatus } from '@/domain/entities';
import { toChipBigInt, toChipBigIntOrNull, toChipNumber } from './chip-codec';
import {
  toDomainRoom,
  toDomainRoomStatus,
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
        smallBlind: toChipBigInt(room.settings.smallBlind),
        bigBlind: toChipBigInt(room.settings.bigBlind),
        minBuyIn: toChipBigInt(room.settings.minBuyIn),
        maxBuyIn: toChipBigIntOrNull(room.settings.maxBuyIn),
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
        buyInTotal: toChipBigInt(member.buyInTotal),
        chips: toChipBigInt(member.chips),
      },
      include: { user: { select: { username: true } } },
    });
    return {
      userId: created.userId,
      username: created.user.username,
      seat: created.seat,
      buyInTotal: toChipNumber(created.buyInTotal),
      chips: toChipNumber(created.chips),
      sittingOut: created.sittingOut,
    };
  }

  async removeMember(roomId: string, userId: string): Promise<void> {
    await this.prisma.roomMember.delete({
      where: { roomId_userId: { roomId, userId } },
    });
  }

  async updateMemberChips(
    roomId: string,
    userId: string,
    chips: number,
  ): Promise<void> {
    await this.prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { chips: toChipBigInt(chips) },
    });
  }

  async addMemberFunding(
    roomId: string,
    userId: string,
    amount: number,
  ): Promise<void> {
    await this.prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: {
        chips: { increment: toChipBigInt(amount) },
        buyInTotal: { increment: toChipBigInt(amount) },
      },
    });
  }

  async setMemberSittingOut(
    roomId: string,
    userId: string,
    sittingOut: boolean,
  ): Promise<void> {
    await this.prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { sittingOut },
    });
  }

  async listMembers(roomId: string): Promise<RoomMemberRecord[]> {
    const members = await this.prisma.roomMember.findMany({
      where: { roomId },
      orderBy: { seat: 'asc' },
      include: { user: { select: { username: true } } },
    });
    return members.map((m) => ({
      userId: m.userId,
      username: m.user.username,
      seat: m.seat,
      buyInTotal: toChipNumber(m.buyInTotal),
      chips: toChipNumber(m.chips),
      sittingOut: m.sittingOut,
    }));
  }

  async listRoomsForUser(userId: string): Promise<UserRoomMembership[]> {
    const memberships = await this.prisma.roomMember.findMany({
      where: { userId },
      orderBy: { joinedAt: 'desc' },
      include: { room: { select: { id: true, name: true, status: true } } },
    });
    return memberships.map((m) => ({
      roomId: m.room.id,
      name: m.room.name,
      status: toDomainRoomStatus(m.room.status),
    }));
  }
}
