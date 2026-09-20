import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Meta webhook signature verification, for the WhatsApp Cloud API.
 *
 * Meta signs every callback as `X-Hub-Signature-256: sha256=<hex>` where the
 * hex is HMAC-SHA256 of the raw request body keyed with the app secret. Pure
 * and exported so `tests/unit/messaging.test.ts` can pin it alongside the Svix
 * check: a webhook that marks a guest's message as delivered must not be
 * something anyone on the internet can call.
 */

export function verifyMetaSignature(input: {
  appSecret: string;
  signatureHeader: string | null | undefined;
  body: string;
}): boolean {
  if (!input.appSecret || !input.signatureHeader) return false;

  const [scheme, provided] = input.signatureHeader.split('=', 2);
  if (scheme !== 'sha256' || !provided) return false;

  const expected = createHmac('sha256', input.appSecret).update(input.body).digest('hex');

  const left = Buffer.from(provided, 'utf8');
  const right = Buffer.from(expected, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

/** The header Meta would send. Used by the tests and by nothing else. */
export function signMeta(input: { appSecret: string; body: string }): string {
  return `sha256=${createHmac('sha256', input.appSecret).update(input.body).digest('hex')}`;
}
