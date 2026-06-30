import {
  RoomStatus as PrismaRoomStatus,
  SettlementMode as PrismaSettlementMode,
} from '@prisma/client';
import type {
  Room,
  RoomStatus as DomainRoomStatus,
  SettlementMode as DomainSettlementMode,
} from '@/domain/entities';
import { toChipNumber, toChipNumberOrNull } from './chip-codec';

// --- Enum mapping (database UPPER_CASE <-> domain lower_case unions) ---

export function toDomainRoomStatus(status: PrismaRoomStatus): DomainRoomStatus {
  switch (status) {
    case PrismaRoomStatus.WAITING:
      return 'waiting';
    case PrismaRoomStatus.PLAYING:
      return 'playing';
    case PrismaRoomStatus.ENDED:
      return 'ended';
  }
}

export function toPrismaRoomStatus(status: DomainRoomStatus): PrismaRoomStatus {
  switch (status) {
    case 'waiting':
      return PrismaRoomStatus.WAITING;
    case 'playing':
      return PrismaRoomStatus.PLAYING;
    case 'ended':
      return PrismaRoomStatus.ENDED;
  }
}

export function toDomainSettlementMode(
  mode: PrismaSettlementMode,
): DomainSettlementMode {
  switch (mode) {
    case PrismaSettlementMode.BANKER:
      return 'banker';
    case PrismaSettlementMode.SHOWDOWN:
      return 'showdown';
  }
}

export function toPrismaSettlementMode(
  mode: DomainSettlementMode,
): PrismaSettlementMode {
  switch (mode) {
    case 'banker':
      return PrismaSettlementMode.BANKER;
    case 'showdown':
      return PrismaSettlementMode.SHOWDOWN;
  }
}

/** The Room columns needed to rebuild the domain entity. */
export interface PrismaRoomRow {
  readonly id: string;
  readonly name: string;
  readonly bankerId: string;
  readonly status: PrismaRoomStatus;
  readonly actionTimeoutMs: number;
  readonly smallBlind: bigint;
  readonly bigBlind: bigint;
  readonly minBuyIn: bigint;
  readonly maxBuyIn: bigint | null;
  readonly settlementMode: PrismaSettlementMode;
}

/** Rebuilds a domain Room from its database row. */
export function toDomainRoom(row: PrismaRoomRow): Room {
  return {
    id: row.id,
    name: row.name,
    bankerId: row.bankerId,
    status: toDomainRoomStatus(row.status),
    settings: {
      actionTimeoutMs: row.actionTimeoutMs,
      smallBlind: toChipNumber(row.smallBlind),
      bigBlind: toChipNumber(row.bigBlind),
      minBuyIn: toChipNumber(row.minBuyIn),
      maxBuyIn: toChipNumberOrNull(row.maxBuyIn),
      settlementMode: toDomainSettlementMode(row.settlementMode),
    },
  };
}
