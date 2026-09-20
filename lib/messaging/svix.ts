import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Svix webhook signature verification, which is what Resend uses.
 *
 * Inline rather than the `svix` package: it is one HMAC, and a webhook route is
 * exactly the place where an unaudited dependency is least welcome. Pure and
 * exported so `tests/unit/svix.test.ts` can pin it — a signature check that is
 * never tested is a signature check nobody should trust.
 */

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function verifySvixSignature(input: {
  secret: string;
  id: string;
  timestamp: string;
  signatureHeader: string;
  body: string;
  /** Overridable so a test does not depend on the clock. */
  now?: number;
}): boolean {
  const now = input.now ?? Date.now();
  const sent = Number(input.timestamp) * 1000;

  // Replay window, the same tolerance Svix itself uses: without it a captured
  // request could be replayed to push a delivery row back to `delivered`.
  if (!Number.isFinite(sent) || Math.abs(now - sent) > FIVE_MINUTES_MS) return false;

  let key: Buffer;
  try {
    key = Buffer.from(input.secret.replace(/^whsec_/, ''), 'base64');
  } catch {
    return false;
  }
  if (key.length === 0) return false;

  const expected = createHmac('sha256', key)
    .update(`${input.id}.${input.timestamp}.${input.body}`)
    .digest('base64');

  // The header is a space-separated list of `v1,<signature>` pairs: during a
  // secret rotation more than one is valid at the same time.
  return input.signatureHeader
    .split(' ')
    .map((part) => part.split(',')[1] ?? '')
    .some((candidate) => constantTimeEquals(candidate, expected));
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** The signature header Svix would send. Used by the tests and by nothing else. */
export function signSvix(input: {
  secret: string;
  id: string;
  timestamp: string;
  body: string;
}): string {
  const key = Buffer.from(input.secret.replace(/^whsec_/, ''), 'base64');
  const signature = createHmac('sha256', key)
    .update(`${input.id}.${input.timestamp}.${input.body}`)
    .digest('base64');
  return `v1,${signature}`;
}
