import type { IdGenerator, RoomRepository } from '@/application/ports';
import { createRoom, type RoomSettings } from '@/domain/entities';
import { DEFAULT_BUY_IN } from './funding';
import { toRoomSnapshot, type RoomSnapshot } from './room-snapshot';

export interface CreateRoomInput {
  readonly bankerId: string;
  readonly name: string;
  readonly settings?: Partial<RoomSettings>;
}

/**
 * Creates a room (the creator becomes the banker) and seats them at seat 0.
 * Settings are validated by the domain `createRoom` factory.
 */
export class CreateRoom {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateRoomInput): Promise<RoomSnapshot> {
    const room = createRoom({
      id: this.ids.generate(),
      name: input.name,
      bankerId: input.bankerId,
      settings: input.settings,
    });
    await this.rooms.create(room);
    await this.rooms.addMember(room.id, {
      userId: input.bankerId,
      seat: 0,
      // Temporary default buy-in until task 4.6 adds banker-controlled buy-ins.
      buyInTotal: DEFAULT_BUY_IN,
      chips: DEFAULT_BUY_IN,
    });
    const members = await this.rooms.listMembers(room.id);
    return toRoomSnapshot(room, members);
  }
}
