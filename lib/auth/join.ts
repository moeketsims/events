import { timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db/types';
import { APP_URL } from '@/lib/env';
import { signRaw } from '@/lib/auth/pass';

/**
 * The join token — docs/07 §2.1. One per event, printed as the QR guests scan
 * to register themselves at a table.
 *
 *   join token :  j.<id22>.<sig22>
 *   id22       =  base64url(event uuid bytes)
 *   sig22      =  base64url(HMAC-SHA256(secret, "j." + id22 + "." + nonce))[0:22]
 *
 * The signed input includes a nonce that lives on the event row, so the
 * signature cannot be checked from the token alone: parse it, load the event,
 * recompute with the row's nonce, and require the row to still hold this exact
 * token. Regenerating the nonce revokes every printed code for that event and
 * nothing else; rotating PASS_SIGNING_SECRET is not needed.
 *
 * `verifyToken` in pass.ts is deliberately not extended to accept `j`: its
 * callers assume a self-contained signature.
 */

const ID_LENGTH = 22;
const SIG_LENGTH = 22;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHAPE = /^j\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{22}$/;

function uuidToId22(uuid: string): string {
  if (!UUID_RE.test(uuid)) throw new Error('signJoinToken expects a UUID');
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

function signature(id22: string, nonce: string): string {
  return signRaw(`j.${id22}.${nonce}`);
}

export function signJoinToken(eventId: string, nonce: string): string {
  const id22 = uuidToId22(eventId);
  return `j.${id22}.${signature(id22, nonce)}`;
}

/** Shape check only. The signature needs the row's nonce; see resolveJoinToken. */
export function parseJoinToken(
  token: string | null | undefined,
): { eventId: string; id22: string; sig: string } | null {
  if (!token || !SHAPE.test(token)) return null;
  const [, id22, sig] = token.split('.') as [string, string, string];
  if (id22.length !== ID_LENGTH || sig.length !== SIG_LENGTH) return null;
  const eventId = id22ToUuid(id22);
  return eventId ? { eventId, id22, sig } : null;
}

/** Constant-time check of a parsed token against the nonce stored on the row. */
export function verifyJoinSignature(id22: string, sig: string, nonce: string): boolean {
  const expected = Buffer.from(signature(id22, nonce));
  const actual = Buffer.from(sig);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function joinUrl(token: string): string {
  return `${APP_URL}/join/${token}`;
}

/** The columns the public join page and its action are allowed to see. */
export const JOIN_EVENT_COLUMNS =
  'id, department_id, title, starts_at, venue_name, status, auction_enabled, join_token, join_nonce';

export type JoinEvent = Pick<
  Database['public']['Tables']['events']['Row'],
  | 'id'
  | 'department_id'
  | 'title'
  | 'starts_at'
  | 'venue_name'
  | 'status'
  | 'auction_enabled'
  | 'join_token'
  | 'join_nonce'
>;

/**
 * Parse → load the event by id → recompute with the row's nonce → constant-time
 * compare → require the row to still hold exactly this token. Null on any miss.
 */
export async function resolveJoinToken(
  admin: SupabaseClient<Database>,
  token: string | null | undefined,
): Promise<JoinEvent | null> {
  const parsed = parseJoinToken(token);
  if (!parsed) return null;

  const { data: event } = await admin
    .from('events')
    .select(JOIN_EVENT_COLUMNS)
    .eq('id', parsed.eventId)
    .maybeSingle();

  if (!event || !event.join_token || !event.join_nonce) return null;
  if (!verifyJoinSignature(parsed.id22, parsed.sig, event.join_nonce)) return null;
  if (event.join_token !== token) return null;

  return event;
}
