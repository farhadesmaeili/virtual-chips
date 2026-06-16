import type { RoomMemberRecord } from '@/application/ports';
import type { Room, RoomSettings, RoomStatus } from '@/domain/entities';

export interface RoomMemberSnapshot {
  readonly userId: string;
  readonly username: string;
  readonly seat: number;
  readonly chips: number;
  readonly buyInTotal: number;
}

/** A server-side snapshot of a room and its members (use-case result). */
export interface RoomSnapshot {
  readonly id: string;
  readonly name: string;
  readonly status: RoomStatus;
  readonly settings: RoomSettings;
  readonly bankerId: string;
  readonly members: readonly RoomMemberSnapshot[];
}

export function toRoomSnapshot(
  room: Room,
  members: readonly RoomMemberRecord[],
): RoomSnapshot {
  return {
    id: room.id,
    name: room.name,
    status: room.status,
    settings: room.settings,
    bankerId: room.bankerId,
    members: [...members]
      .sort((a, b) => a.seat - b.seat)
      .map((m) => ({
        userId: m.userId,
        username: m.username,
        seat: m.seat,
        chips: m.chips,
        buyInTotal: m.buyInTotal,
      })),
  };
}
