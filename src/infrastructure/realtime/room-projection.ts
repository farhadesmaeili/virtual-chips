import type { ChipRequest } from '@/application/ports';
import type { RoomSnapshot } from '@/application/use-cases';
import type { RoomSettings, RoomStatus } from '@/domain/entities';

/** A pending chip request as shown to clients — no raw userId. */
export interface PublicChipRequest {
  readonly id: string;
  readonly seat: number;
  readonly username: string;
  readonly amount: number;
}

export function toPublicChipRequest(request: ChipRequest): PublicChipRequest {
  return {
    id: request.id,
    seat: request.seat,
    username: request.username,
    amount: request.amount,
  };
}

/** A member as broadcast to clients — no raw userId or other internal data. */
export interface PublicRoomMember {
  readonly seat: number;
  readonly username: string;
  readonly chips: number;
  readonly buyInTotal: number;
  readonly isBanker: boolean;
}

/** Display-only room state broadcast on `room:state`. */
export interface PublicRoomState {
  readonly id: string;
  readonly name: string;
  readonly status: RoomStatus;
  readonly settings: RoomSettings;
  readonly members: readonly PublicRoomMember[];
}

/**
 * Projects a server-side RoomSnapshot to the public state. Raw userIds are
 * dropped; the banker is exposed only as an `isBanker` flag per member
 * (docs/REALTIME-EVENTS.md: never broadcast internal data).
 */
export function toPublicRoomState(snapshot: RoomSnapshot): PublicRoomState {
  return {
    id: snapshot.id,
    name: snapshot.name,
    status: snapshot.status,
    settings: snapshot.settings,
    members: snapshot.members.map((m) => ({
      seat: m.seat,
      username: m.username,
      chips: m.chips,
      buyInTotal: m.buyInTotal,
      isBanker: m.userId === snapshot.bankerId,
    })),
  };
}
