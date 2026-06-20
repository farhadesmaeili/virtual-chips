import { describe, expect, it } from 'vitest';
import { InvalidRoomSettingsError } from '../errors';
import { createRoom, isBanker, minBet, withStatus } from './room';

function room() {
  return createRoom({ id: 'r1', name: 'Table 1', bankerId: 'banker' });
}

describe('createRoom', () => {
  it('applies default settings and waiting status', () => {
    const r = room();
    expect(r.status).toBe('waiting');
    expect(r.settings).toEqual({
      actionTimeoutMs: 30_000,
      smallBlind: 1,
      bigBlind: 2,
      settlementMode: 'banker',
    });
  });

  it('merges partial settings over the defaults', () => {
    const r = createRoom({
      id: 'r',
      name: 'n',
      bankerId: 'b',
      settings: { bigBlind: 10, settlementMode: 'showdown' },
    });
    expect(r.settings.smallBlind).toBe(1);
    expect(r.settings.bigBlind).toBe(10);
    expect(r.settings.settlementMode).toBe('showdown');
  });

  it('rejects smallBlind below 1', () => {
    expect(() =>
      createRoom({
        id: 'r',
        name: 'n',
        bankerId: 'b',
        settings: { smallBlind: 0 },
      }),
    ).toThrow(InvalidRoomSettingsError);
  });

  it('rejects bigBlind smaller than smallBlind', () => {
    expect(() =>
      createRoom({
        id: 'r',
        name: 'n',
        bankerId: 'b',
        settings: { smallBlind: 5, bigBlind: 4 },
      }),
    ).toThrow(InvalidRoomSettingsError);
  });

  it('rejects bigBlind equal to smallBlind', () => {
    expect(() =>
      createRoom({
        id: 'r',
        name: 'n',
        bankerId: 'b',
        settings: { smallBlind: 5, bigBlind: 5 },
      }),
    ).toThrow(InvalidRoomSettingsError);
  });

  it('rejects a too-small action timeout', () => {
    expect(() =>
      createRoom({
        id: 'r',
        name: 'n',
        bankerId: 'b',
        settings: { actionTimeoutMs: 500 },
      }),
    ).toThrow(InvalidRoomSettingsError);
  });

  it('rejects non-integer blinds', () => {
    expect(() =>
      createRoom({
        id: 'r',
        name: 'n',
        bankerId: 'b',
        settings: { bigBlind: 2.5 },
      }),
    ).toThrow();
  });
});

describe('helpers', () => {
  it('isBanker checks the room banker', () => {
    expect(isBanker(room(), 'banker')).toBe(true);
    expect(isBanker(room(), 'someone')).toBe(false);
  });

  it('minBet equals the big blind', () => {
    expect(minBet(room())).toBe(2);
  });

  it('withStatus returns a new room with the status changed', () => {
    const r = room();
    const playing = withStatus(r, 'playing');
    expect(playing.status).toBe('playing');
    expect(r.status).toBe('waiting');
  });
});
