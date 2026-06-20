import type { RoomRepository } from '@/application/ports';
import { MAX_SEATS } from '@/domain/entities';
import {
  AlreadyInRoomError,
  RoomFullError,
  RoomNotFoundError,
} from '@/domain/errors';
import { toRoomSnapshot, type RoomSnapshot } from './room-snapshot';

export interface JoinRoomInput {
  readonly userId: string;
  readonly roomId: string;
}

/** Adds a user to the first free seat of a room. */
export class JoinRoom {
  constructor(private readonly rooms: RoomRepository) {}

  async execute({ userId, roomId }: JoinRoomInput): Promise<RoomSnapshot> {
    const room = await this.rooms.findById(roomId);
    if (room === null) throw new RoomNotFoundError(roomId);

    const members = await this.rooms.listMembers(roomId);
    if (members.some((m) => m.userId === userId)) {
      throw new AlreadyInRoomError(roomId);
    }

    const seat = firstFreeSeat(
      members.map((m) => m.seat),
      MAX_SEATS,
    );
    if (seat === null) throw new RoomFullError(MAX_SEATS);

    await this.rooms.addMember(roomId, {
      userId,
      seat,
      // Players sit with no chips; the banker funds them via chip requests
      // (task 4.15). They can't be dealt in until funded.
      buyInTotal: 0,
      chips: 0,
    });
    const updated = await this.rooms.listMembers(roomId);
    return toRoomSnapshot(room, updated);
  }
}

/** Lowest seat index in [0, max) not already taken, or null if the table is full. */
function firstFreeSeat(taken: readonly number[], max: number): number | null {
  const occupied = new Set(taken);
  for (let seat = 0; seat < max; seat++) {
    if (!occupied.has(seat)) return seat;
  }
  return null;
}
