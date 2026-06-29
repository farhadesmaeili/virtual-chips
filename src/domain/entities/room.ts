import { InvalidRoomSettingsError } from '../errors';
import { Chips } from '../value-objects/chips';
import { BUY_IN_MAX_BB_MULTIPLE, BUY_IN_MIN_BB_MULTIPLE } from './buy-in';

export type RoomStatus = 'waiting' | 'playing' | 'ended';
export type SettlementMode = 'banker' | 'showdown';

/** Maximum number of seats (players) at a table. */
export const MAX_SEATS = 9;

export interface RoomSettings {
  readonly actionTimeoutMs: number;
  readonly smallBlind: number;
  readonly bigBlind: number;
  /** Table minimum for a first buy-in (chips). */
  readonly minBuyIn: number;
  /** Table maximum stack (chips), or null for no maximum. */
  readonly maxBuyIn: number | null;
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
  // Static fallback (10x/20x of the default BB=2). The real BB-relative
  // derivation for a created room lives in `deriveBuyInDefaults`, applied by the
  // CreateRoom use-case so the bounds track the chosen big blind.
  minBuyIn: 20,
  maxBuyIn: 40,
  settlementMode: 'banker',
};

/**
 * Fills the buy-in bounds from the (effective) big blind when the caller omits
 * them: `minBuyIn = 10 * bigBlind`, `maxBuyIn = 20 * bigBlind`. A supplied value
 * wins — including an explicit `maxBuyIn: null` ("no maximum"), which is kept as
 * null rather than derived. Returns a settings patch to thread into `createRoom`.
 */
export function deriveBuyInDefaults(
  settings?: Partial<RoomSettings>,
): Partial<RoomSettings> {
  const bigBlind = settings?.bigBlind ?? DEFAULT_SETTINGS.bigBlind;
  return {
    ...settings,
    minBuyIn: settings?.minBuyIn ?? bigBlind * BUY_IN_MIN_BB_MULTIPLE,
    maxBuyIn:
      settings?.maxBuyIn !== undefined
        ? settings.maxBuyIn
        : bigBlind * BUY_IN_MAX_BB_MULTIPLE,
  };
}

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
  if (s.bigBlind <= s.smallBlind) {
    throw new InvalidRoomSettingsError(
      'bigBlind must be greater than smallBlind',
    );
  }
  if (!Number.isInteger(s.actionTimeoutMs) || s.actionTimeoutMs < 1000) {
    throw new InvalidRoomSettingsError(
      'actionTimeoutMs must be an integer of at least 1000ms',
    );
  }
  // Buy-in bounds: a positive minimum, and a maximum that is either disabled
  // (null) or a whole number not below the minimum.
  if (!Number.isInteger(s.minBuyIn) || s.minBuyIn < 1) {
    throw new InvalidRoomSettingsError('minBuyIn must be at least 1');
  }
  if (s.maxBuyIn !== null) {
    if (!Number.isInteger(s.maxBuyIn) || s.maxBuyIn < s.minBuyIn) {
      throw new InvalidRoomSettingsError(
        'maxBuyIn must be at least minBuyIn (or null for no maximum)',
      );
    }
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
