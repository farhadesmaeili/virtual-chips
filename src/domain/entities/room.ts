import { InvalidRoomSettingsError } from '../errors';
import { Chips } from '../value-objects/chips';

export type RoomStatus = 'waiting' | 'playing' | 'ended';
export type SettlementMode = 'banker' | 'showdown';

/** Maximum number of seats (players) at a table. */
export const MAX_SEATS = 9;

export interface RoomSettings {
  readonly actionTimeoutMs: number;
  readonly smallBlind: number;
  readonly bigBlind: number;
  readonly settlementMode: SettlementMode;
}

/**
 * A room groups players and holds the game settings. The user who created it
 * is the banker. Immutable: helpers return a new Room.
 */
export interface Room {
  readonly id: string;
  readonly name: string;
  readonly bankerId: string;
  readonly status: RoomStatus;
  readonly settings: RoomSettings;
}

const DEFAULT_SETTINGS: RoomSettings = {
  actionTimeoutMs: 30_000,
  smallBlind: 1,
  bigBlind: 2,
  settlementMode: 'banker',
};

export interface CreateRoomInput {
  id: string;
  name: string;
  bankerId: string;
  settings?: Partial<RoomSettings>;
}

export function createRoom(input: CreateRoomInput): Room {
  const settings: RoomSettings = { ...DEFAULT_SETTINGS, ...input.settings };
  validateSettings(settings);
  return {
    id: input.id,
    name: input.name,
    bankerId: input.bankerId,
    status: 'waiting',
    settings,
  };
}

function validateSettings(s: RoomSettings): void {
  // Blinds are chip amounts: must be non-negative integers.
  Chips.of(s.smallBlind);
  Chips.of(s.bigBlind);
  if (s.smallBlind < 1) {
    throw new InvalidRoomSettingsError('smallBlind must be at least 1');
  }
  if (s.bigBlind < s.smallBlind) {
    throw new InvalidRoomSettingsError(
      'bigBlind must be greater than or equal to smallBlind',
    );
  }
  if (!Number.isInteger(s.actionTimeoutMs) || s.actionTimeoutMs < 1000) {
    throw new InvalidRoomSettingsError(
      'actionTimeoutMs must be an integer of at least 1000ms',
    );
  }
}

export function isBanker(room: Room, userId: string): boolean {
  return room.bankerId === userId;
}

/** Minimum bet for the room — equal to the big blind. */
export function minBet(room: Room): number {
  return room.settings.bigBlind;
}

export function withStatus(room: Room, status: RoomStatus): Room {
  return { ...room, status };
}
