import { describe, expect, it } from 'vitest';

// The library reads PASS_SIGNING_SECRET at call time, so set it before import.
process.env.PASS_SIGNING_SECRET ??= 'dGVzdC1zZWNyZXQtZm9yLXVuaXQtdGVzdHMtMzJieXRlcyE=';

const { signToken, verifyToken, verifyTokenOfKind, extractToken, newTokenId } =
  await import('@/lib/auth/pass');

const UUID = '3f1c7a2e-9b4d-4e6a-8f21-5c0d7e8a1b34';
const OTHER_UUID = 'a0b1c2d3-e4f5-4a6b-8c7d-9e0f1a2b3c4d';

describe('signToken / verifyToken', () => {
  it('round-trips a pass token', () => {
    const token = signToken('p', UUID);
    expect(verifyToken(token)).toEqual({ kind: 'p', id: UUID });
  });

  it('round-trips an RSVP token', () => {
    const token = signToken('r', UUID);
    expect(verifyToken(token)).toEqual({ kind: 'r', id: UUID });
  });

  it('produces the documented shape and length', () => {
    const token = signToken('p', UUID);
    const [kind, id22, sig] = token.split('.');
    expect(kind).toBe('p');
    expect(id22).toHaveLength(22);
    expect(sig).toHaveLength(22);
    expect(token).toHaveLength(47); // 1 + 1 + 22 + 1 + 22
    expect(token).toMatch(/^[pr]\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{22}$/);
  });

  it('is stable for a fixed secret', () => {
    expect(signToken('p', UUID)).toBe(signToken('p', UUID));
  });

  it('separates the two kinds: the same id signs differently', () => {
    expect(signToken('p', UUID)).not.toBe(signToken('r', UUID));
  });

  it('rejects a tampered signature', () => {
    const token = signToken('p', UUID);
    const flipped = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
    expect(verifyToken(flipped)).toBeNull();
  });

  it('rejects a tampered id', () => {
    const [, , sig] = signToken('p', UUID).split('.');
    const otherId = signToken('p', OTHER_UUID).split('.')[1];
    expect(verifyToken(`p.${otherId}.${sig}`)).toBeNull();
  });

  it('rejects a swapped kind prefix', () => {
    const [, id22, sig] = signToken('p', UUID).split('.');
    expect(verifyToken(`r.${id22}.${sig}`)).toBeNull();
  });

  it('rejects malformed input', () => {
    expect(verifyToken(null)).toBeNull();
    expect(verifyToken(undefined)).toBeNull();
    expect(verifyToken('')).toBeNull();
    expect(verifyToken('not-a-token')).toBeNull();
    expect(verifyToken('p.short.sig')).toBeNull();
    expect(verifyToken('x.aaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbbbb')).toBeNull();
    expect(verifyToken('p.aaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbbbb.extra')).toBeNull();
  });

  it('refuses to sign something that is not a UUID', () => {
    expect(() => signToken('p', 'nope')).toThrow(/UUID/);
  });
});

describe('verifyTokenOfKind', () => {
  it('returns the id for the expected kind and null for the other', () => {
    const pass = signToken('p', UUID);
    expect(verifyTokenOfKind(pass, 'p')).toBe(UUID);
    expect(verifyTokenOfKind(pass, 'r')).toBeNull();
  });
});

describe('extractToken', () => {
  const token = 'p.AAAAAAAAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB';

  it('passes a bare token through', () => {
    expect(extractToken(token)).toBe(token);
    expect(extractToken(`  ${token}  `)).toBe(token);
  });

  it('takes the last path segment of a scanned pass URL', () => {
    expect(extractToken(`https://cut-events.vercel.app/p/${token}`)).toBe(token);
    expect(extractToken(`http://localhost:3000/p/${token}`)).toBe(token);
  });
});

describe('newTokenId', () => {
  it('returns a signable UUID', () => {
    const id = newTokenId();
    expect(verifyToken(signToken('p', id))).toEqual({ kind: 'p', id });
  });
});
