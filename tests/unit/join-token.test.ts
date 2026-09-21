import { describe, expect, it } from 'vitest';

// The library reads PASS_SIGNING_SECRET at call time, so set it before import.
process.env.PASS_SIGNING_SECRET ??= 'dGVzdC1zZWNyZXQtZm9yLXVuaXQtdGVzdHMtMzJieXRlcyE=';

const { signJoinToken, parseJoinToken, verifyJoinSignature, joinUrl } =
  await import('@/lib/auth/join');
const { signToken } = await import('@/lib/auth/pass');
const { APP_URL } = await import('@/lib/env');

const EVENT = '3f1c7a2e-9b4d-4e6a-8f21-5c0d7e8a1b34';
const NONCE = 'a0b1c2d3-e4f5-4a6b-8c7d-9e0f1a2b3c4d';
const OTHER_NONCE = '0f1e2d3c-4b5a-4968-8776-655443322110';

describe('signJoinToken / parseJoinToken', () => {
  it('round-trips a join token to the event id', () => {
    const token = signJoinToken(EVENT, NONCE);
    expect(parseJoinToken(token)?.eventId).toBe(EVENT);
    expect(token).toHaveLength(47);
    expect(token).toMatch(/^j\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{22}$/);
  });

  it('gives a different signature for the same event under a different nonce', () => {
    const a = signJoinToken(EVENT, NONCE);
    const b = signJoinToken(EVENT, OTHER_NONCE);
    expect(a).not.toBe(b);
    expect(a.split('.')[1]).toBe(b.split('.')[1]); // same id22
  });

  it('verifies against the nonce it was signed with, and only that one', () => {
    const { id22, sig } = parseJoinToken(signJoinToken(EVENT, NONCE))!;
    expect(verifyJoinSignature(id22, sig, NONCE)).toBe(true);
    expect(verifyJoinSignature(id22, sig, OTHER_NONCE)).toBe(false);
  });

  it('does not verify with one signature character changed', () => {
    const token = signJoinToken(EVENT, NONCE);
    const flipped = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
    const { id22, sig } = parseJoinToken(flipped)!;
    expect(verifyJoinSignature(id22, sig, NONCE)).toBe(false);
  });

  it('rejects p. and r. tokens and malformed input', () => {
    expect(parseJoinToken(signToken('p', EVENT))).toBeNull();
    expect(parseJoinToken(signToken('r', EVENT))).toBeNull();
    expect(parseJoinToken(null)).toBeNull();
    expect(parseJoinToken('')).toBeNull();
    expect(parseJoinToken('j.short.sig')).toBeNull();
  });

  it('refuses to sign something that is not a UUID', () => {
    expect(() => signJoinToken('nope', NONCE)).toThrow(/UUID/);
  });
});

describe('joinUrl', () => {
  it('is APP_URL + /join/ + token', () => {
    const token = signJoinToken(EVENT, NONCE);
    expect(joinUrl(token)).toBe(`${APP_URL}/join/${token}`);
  });
});
