import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { serverEnv } from '@/lib/env';

/**
 * Pass and RSVP tokens. BUILD-SPEC §6.
 *
 *   pass token :  p.<id22>.<sig22>
 *   rsvp token :  r.<id22>.<sig22>
 *
 *   id22  = base64url(uuid bytes)                                  (22 chars)
 *   sig22 = base64url(HMAC-SHA256(secret, kind + "." + id22))[0:22]
 *
 * 47 characters total, which keeps a QR at error correction M small enough to
 * scan from a phone screen across a table.
 *
 * Rotating PASS_SIGNING_SECRET invalidates every issued pass and RSVP link.
 */

export type TokenKind = 'p' | 'r';

const ID_LENGTH = 22;
const SIG_LENGTH = 22;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secret(): string {
  return serverEnv('PASS_SIGNING_SECRET');
}

function uuidToId22(uuid: string): string {
  if (!UUID_RE.test(uuid)) throw new Error('signToken expects a UUID');
  return Buffer.from(uuid.replace(/-/g, ''), 'hex').toString('base64url');
}

function id22ToUuid(id22: string): string | null {
  let bytes: Buffer;
  try {
    bytes = Buffer.from(id22, 'base64url');
  } catch {
    return null;
  }
  if (bytes.length !== 16) return null;
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

function sign(kind: TokenKind, id22: string): string {
  return createHmac('sha256', secret())
    .update(`${kind}.${id22}`)
    .digest('base64url')
    .slice(0, SIG_LENGTH);
}

/**
 * The bare HMAC step, for a token kind whose signed input is not `kind.id22`.
 * The join token (lib/auth/join.ts) signs over a nonce stored on the row, so
 * it needs the same secret and truncation without the self-contained shape.
 */
export function signRaw(input: string): string {
  return createHmac('sha256', secret()).update(input).digest('base64url').slice(0, SIG_LENGTH);
}

export function signToken(kind: TokenKind, id: string): string {
  const id22 = uuidToId22(id);
  return `${kind}.${id22}.${sign(kind, id22)}`;
}

/** Constant-time verification. Returns `null` for anything that does not check out. */
export function verifyToken(
  token: string | null | undefined,
): { kind: TokenKind; id: string } | null {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [kind, id22, sig] = parts as [string, string, string];

  if (kind !== 'p' && kind !== 'r') return null;
  if (id22.length !== ID_LENGTH || sig.length !== SIG_LENGTH) return null;

  const expected = Buffer.from(sign(kind, id22));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length) return null;
  if (!timingSafeEqual(expected, actual)) return null;

  const id = id22ToUuid(id22);
  return id ? { kind, id } : null;
}

/** Verify and require a particular kind — the common case at a route boundary. */
export function verifyTokenOfKind(
  token: string | null | undefined,
  kind: TokenKind,
): string | null {
  const result = verifyToken(token);
  return result && result.kind === kind ? result.id : null;
}

/**
 * The scanner accepts either a bare token or the full pass URL the QR encodes.
 * Returns the token portion, unverified.
 */
export function extractToken(scanned: string): string {
  const trimmed = scanned.trim();
  if (!trimmed.includes('://')) return trimmed;
  try {
    const segments = new URL(trimmed).pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] ?? trimmed;
  } catch {
    return trimmed;
  }
}

/** A fresh id for a row that is about to be created with its token. */
export function newTokenId(): string {
  return randomUUID();
}
