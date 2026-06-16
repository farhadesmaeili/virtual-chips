// Client-side view of the realtime contract (docs/REALTIME-EVENTS.md). Kept in
// the presentation layer so components never import server infrastructure.

export interface PublicRoomMember {
  readonly seat: number;
  readonly username: string;
  readonly chips: number;
  readonly buyInTotal: number;
  readonly isBanker: boolean;
}

export interface PublicRoomState {
  readonly id: string;
  readonly name: string;
  readonly status: 'waiting' | 'playing' | 'ended';
  readonly members: readonly PublicRoomMember[];
}

export interface SocketError {
  readonly code: string;
  readonly message: string;
}

export interface SessionReady {
  readonly user: { readonly id: string; readonly username: string };
}
