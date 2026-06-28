import type {
  ChipRequest,
  UserGameSettlement,
  UserRoomMembership,
} from '@/application/ports';
import type { EndGameResult, RoomSnapshot } from '@/application/use-cases';
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

/** A room the user belongs to, for the lobby's "Your table" card (task 4.13). */
export interface PublicUserRoom {
  readonly roomId: string;
  readonly name: string;
  readonly status: RoomStatus;
}

export function toPublicUserRoom(room: UserRoomMembership): PublicUserRoom {
  return { roomId: room.roomId, name: room.name, status: room.status };
}

/**
 * A finished game in the user's history (task 6.3), as shown to the client. No
 * raw userId is exposed; `endedAt` is serialized to an ISO string so the wire
 * contract is explicit (the client parses it).
 */
export interface PublicGameHistoryEntry {
  readonly gameId: string;
  readonly net: number;
  readonly roomName: string;
  readonly endedAt: string;
}

export function toPublicGameHistoryEntry(
  settlement: UserGameSettlement,
): PublicGameHistoryEntry {
  return {
    gameId: settlement.gameId,
    net: settlement.net,
    roomName: settlement.roomName,
    endedAt: settlement.endedAt.toISOString(),
  };
}

/** A member as broadcast to clients — no raw userId or other internal data. */
export interface PublicRoomMember {
  readonly seat: number;
  readonly username: string;
  readonly chips: number;
  readonly buyInTotal: number;
  readonly isBanker: boolean;
  readonly sittingOut: boolean;
}

/** Display-only room state broadcast on `room:state`. */
export interface PublicRoomState {
  readonly id: string;
  readonly name: string;
  readonly status: RoomStatus;
  readonly settings: RoomSettings;
  readonly members: readonly PublicRoomMember[];
}

/** A player's end-of-game net, broadcast on `game:ended` (no raw userId). */
export interface PublicNetResult {
  readonly seat: number;
  readonly net: number;
}

/** Display-only end-of-game settlement broadcast on `game:ended`. */
export interface PublicGameEnded {
  readonly nets: readonly PublicNetResult[];
  readonly rake: number;
}

/**
 * Projects an EndGame result to the public `game:ended` payload. Raw userIds and
 * the internal gameId are dropped — clients see seat + net only (the projection
 * rule: never broadcast internal data).
 */
export function toPublicGameEnded(result: EndGameResult): PublicGameEnded {
  return {
    nets: result.nets.map((n) => ({ seat: n.seat, net: n.net })),
    rake: result.rake,
  };
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
      sittingOut: m.sittingOut,
    })),
  };
}
