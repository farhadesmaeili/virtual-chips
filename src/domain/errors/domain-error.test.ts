import { describe, expect, it } from 'vitest';
import {
  DomainError,
  HandNotInBettingError,
  InsufficientChipsError,
  InvalidActionError,
  InvalidChipsAmountError,
  InvalidRaiseError,
  InvalidRoomSettingsError,
  InvalidSettlementError,
  isDomainError,
  NoOpenGameError,
  NotBankerError,
  NotYourTurnError,
  RoomFullError,
  type DomainErrorCode,
} from './domain-error';

interface Case {
  readonly name: string;
  readonly error: DomainError;
  readonly code: DomainErrorCode;
}

const cases: Case[] = [
  {
    name: 'InvalidChipsAmountError',
    error: new InvalidChipsAmountError(-1),
    code: 'INVALID_CHIPS_AMOUNT',
  },
  {
    name: 'InsufficientChipsError',
    error: new InsufficientChipsError(10, 20),
    code: 'INSUFFICIENT_CHIPS',
  },
  {
    name: 'InvalidRoomSettingsError',
    error: new InvalidRoomSettingsError('bad'),
    code: 'INVALID_ROOM_SETTINGS',
  },
  {
    name: 'RoomFullError',
    error: new RoomFullError(9),
    code: 'ROOM_FULL',
  },
  {
    name: 'NotYourTurnError',
    error: new NotYourTurnError(2, 1),
    code: 'NOT_YOUR_TURN',
  },
  {
    name: 'InvalidActionError',
    error: new InvalidActionError('nope'),
    code: 'INVALID_ACTION',
  },
  {
    name: 'InvalidRaiseError',
    error: new InvalidRaiseError('too small'),
    code: 'INVALID_RAISE',
  },
  {
    name: 'HandNotInBettingError',
    error: new HandNotInBettingError('settled'),
    code: 'HAND_NOT_IN_BETTING',
  },
  {
    name: 'NotBankerError',
    error: new NotBankerError('u1'),
    code: 'NOT_BANKER',
  },
  {
    name: 'NoOpenGameError',
    error: new NoOpenGameError('r1'),
    code: 'NO_OPEN_GAME',
  },
  {
    name: 'InvalidSettlementError',
    error: new InvalidSettlementError('bad'),
    code: 'INVALID_SETTLEMENT',
  },
];

describe('domain errors — consistency', () => {
  it.each(cases)('$name extends DomainError and Error', ({ error }) => {
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
  });

  it.each(cases)('$name carries the expected code', ({ error, code }) => {
    expect(error.code).toBe(code);
  });

  it.each(cases)('$name sets name to the class name', ({ error, name }) => {
    expect(error.name).toBe(name);
  });

  it.each(cases)('$name has a non-empty message', ({ error }) => {
    expect(error.message.length).toBeGreaterThan(0);
  });

  it('every error code is unique', () => {
    const codes = cases.map((c) => c.error.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('error context fields', () => {
  it('InsufficientChipsError exposes available and requested', () => {
    const e = new InsufficientChipsError(10, 25);
    expect(e.available).toBe(10);
    expect(e.requested).toBe(25);
  });

  it('NotYourTurnError exposes seat and actingSeat (null-safe message)', () => {
    expect(new NotYourTurnError(3, null).message).toContain('none');
  });

  it('NotBankerError works with and without a userId', () => {
    expect(new NotBankerError().message).toContain('banker');
    expect(new NotBankerError('alice').message).toContain('alice');
  });

  it('RoomFullError exposes the capacity', () => {
    expect(new RoomFullError(6).capacity).toBe(6);
  });
});

describe('isDomainError', () => {
  it('is true for a domain error', () => {
    expect(isDomainError(new InvalidActionError('x'))).toBe(true);
  });

  it('is false for a plain Error or non-error value', () => {
    expect(isDomainError(new Error('plain'))).toBe(false);
    expect(isDomainError('oops')).toBe(false);
    expect(isDomainError(undefined)).toBe(false);
  });
});
