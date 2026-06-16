import type { JWT } from 'next-auth/jwt';
import { describe, expect, it } from 'vitest';
import { parseCookieHeader, socketUserFromToken } from './socket-auth';

describe('parseCookieHeader', () => {
  it('parses a multi-cookie header into a map', () => {
    expect(parseCookieHeader('a=1; b=two; c=3')).toEqual({
      a: '1',
      b: 'two',
      c: '3',
    });
  });

  it('returns an empty map for undefined or empty input', () => {
    expect(parseCookieHeader(undefined)).toEqual({});
    expect(parseCookieHeader('')).toEqual({});
  });

  it('keeps the session-token value (which contains dots) intact', () => {
    const jwt = 'eyJabc.def.ghi';
    expect(parseCookieHeader(`next-auth.session-token=${jwt}`)).toEqual({
      'next-auth.session-token': jwt,
    });
  });

  it('url-decodes values', () => {
    expect(parseCookieHeader('x=a%20b')).toEqual({ x: 'a b' });
  });
});

describe('socketUserFromToken', () => {
  it('maps a valid token to a socket user', () => {
    const token = { id: 'u1', username: 'alice' } as JWT;
    expect(socketUserFromToken(token)).toEqual({ id: 'u1', username: 'alice' });
  });

  it('defaults username to empty string when absent', () => {
    const token = { id: 'u1' } as unknown as JWT;
    expect(socketUserFromToken(token)).toEqual({ id: 'u1', username: '' });
  });

  it('returns null for a null token (anonymous)', () => {
    expect(socketUserFromToken(null)).toBeNull();
  });

  it('returns null when the id is missing or empty', () => {
    expect(socketUserFromToken({ username: 'x' } as unknown as JWT)).toBeNull();
    expect(
      socketUserFromToken({ id: '', username: 'x' } as unknown as JWT),
    ).toBeNull();
  });
});
