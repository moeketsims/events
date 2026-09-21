import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyTokenOfKind } from '@/lib/auth/pass';
import { createAdminClient } from '@/lib/supabase/admin';
import { AUCTION_TERMS_VERSION, CONSENT_PURPOSE, CONSENT_SOURCE } from '@/lib/consent';

/**
 * The one way a bid enters the ledger — BUILD-SPEC §7.3, CLAUDE.md.
 *
 * Everything here is a gate in front of `place_bid`, which is granted to
 * `service_role` alone (0004) and does the real work under a row lock: the
 * minimum, the soft close, the realtime events and the outbid notice all
 * happen inside the function. This route authenticates the pass, rate limits,
 * records the auction terms on first bid, and passes the call through.
 *
 * `terms_required` is this route's own result, not the function's: the terms
 * are a product rule about consent, not a rule about the ledger. So is
 * `no_contact`: an attendee row with no contact has nowhere to record that
 * consent, and a bid without recorded terms is refused rather than assumed.
 */

export const runtime = 'nodejs';

const schema = z.object({
  lotId: z.uuid(),
  amount: z.coerce.number().positive().max(100_000_000).multipleOf(0.01),
  acceptTerms: z.boolean().optional(),
  token: z.string().min(10).max(200).optional(),
});

export type BidResult =
  | 'ok'
  | 'too_low'
  | 'lot_closed'
  | 'not_checked_in'
  | 'not_an_attendee'
  | 'lot_not_found'
  | 'terms_required'
  | 'no_contact'
  | 'invalid'
  | 'rate_limited';

export type BidResponse = {
  result: BidResult;
  highBid: number | null;
  nextMin: number | null;
  closesAt: string | null;
  /** The terms to show when `result` is `terms_required`. */
  termsVersion?: string;
};

/**
 * Ten bids per ten seconds per attendee, in memory (BUILD-SPEC §7.3). It is a
 * courtesy, not a security control: it resets when the instance recycles and
 * every instance keeps its own. The real protection against a runaway client
 * is that `place_bid` rejects anything below the minimum anyway.
 */
const WINDOW_MS = 10_000;
const MAX_IN_WINDOW = 10;
const recent = new Map<string, number[]>();

function rateLimited(attendeeId: string, now = Date.now()): boolean {
  const hits = (recent.get(attendeeId) ?? []).filter((at) => now - at < WINDOW_MS);
  hits.push(now);
  recent.set(attendeeId, hits);

  // Keep the map from growing without bound on a long-lived instance.
  if (recent.size > 5000) {
    for (const [key, times] of recent) {
      if (times.every((at) => now - at >= WINDOW_MS)) recent.delete(key);
    }
  }

  return hits.length > MAX_IN_WINDOW;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const { lotId, amount, acceptTerms } = parsed.data;

  // The token comes from the body on the bidding page, or from the cookie the
  // middleware mirrored out of the pass URL. Either way it is verified here.
  const cookieToken = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('cut_pass='))
    ?.slice('cut_pass='.length);

  const token = parsed.data.token ?? (cookieToken ? decodeURIComponent(cookieToken) : undefined);
  const attendeeId = verifyTokenOfKind(token, 'p');
  if (!attendeeId) return json({ result: 'invalid', highBid: null, nextMin: null, closesAt: null });

  const admin = createAdminClient();

  const { data: attendee } = await admin
    .from('attendees')
    .select('id, contact_id, pass_token, checked_in_at')
    .eq('id', attendeeId)
    .maybeSingle();

  // A verified signature is not enough: a reissued pass revokes the old link.
  if (!attendee || attendee.pass_token !== token) {
    return json({ result: 'invalid', highBid: null, nextMin: null, closesAt: null });
  }

  if (rateLimited(attendee.id)) {
    return json({ result: 'rate_limited', highBid: null, nextMin: null, closesAt: null }, 429);
  }

  // The auction terms are recorded against the *contact*, because that is what
  // `consents` is keyed by. A plus-one shares the host's contact and so
  // inherits their acceptance; a walk-in has a contact of their own. Every
  // attendee the platform creates has one; a row without one cannot evidence
  // acceptance, so it cannot bid.
  if (!attendee.contact_id) {
    return json({ result: 'no_contact', highBid: null, nextMin: null, closesAt: null });
  }

  const { data: consent } = await admin
    .from('consents')
    .select('id')
    .eq('contact_id', attendee.contact_id)
    .eq('purpose', CONSENT_PURPOSE.auctionTerms)
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle();

  if (!consent) {
    if (!acceptTerms) {
      return json({
        result: 'terms_required',
        highBid: null,
        nextMin: null,
        closesAt: null,
        termsVersion: AUCTION_TERMS_VERSION,
      });
    }

    const { error: consentError } = await admin.from('consents').insert({
      contact_id: attendee.contact_id,
      purpose: CONSENT_PURPOSE.auctionTerms,
      channel: 'in_app',
      wording_version: AUCTION_TERMS_VERSION,
      source: CONSENT_SOURCE.auctionBid,
    });
    if (consentError) {
      return NextResponse.json({ error: consentError.message }, { status: 500 });
    }
  }

  const { data, error } = await admin.rpc('place_bid', {
    p_lot_id: lotId,
    p_attendee_id: attendee.id,
    p_amount: amount,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return json({ result: 'invalid', highBid: null, nextMin: null, closesAt: null });

  return json({
    result: row.result as BidResult,
    highBid: row.high_bid === null || row.high_bid === undefined ? null : Number(row.high_bid),
    nextMin: row.next_min === null || row.next_min === undefined ? null : Number(row.next_min),
    closesAt: row.closes_at ?? null,
  });
}

function json(payload: BidResponse, status = 200) {
  return NextResponse.json(payload, { status, headers: { 'Cache-Control': 'no-store' } });
}
