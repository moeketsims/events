import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { optionalEnv } from '@/lib/env';
import { verifySvixSignature } from '@/lib/messaging/svix';
import type { Database } from '@/lib/db/types';

type DeliveryStatus = Database['public']['Enums']['delivery_status'];

/**
 * Resend delivery events — BUILD-SPEC §7.5.
 *
 * Resend signs webhooks with Svix; `lib/messaging/svix.ts` does the HMAC and
 * is unit-tested. The raw body is needed byte-for-byte, so this route reads
 * `request.text()` and never `request.json()` before verifying.
 */

export const runtime = 'nodejs';

/** How far a status may move. A `delivered` event must not undo an `opened`. */
const RANK: Record<DeliveryStatus, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  bounced: 4,
  failed: 4,
};

const EVENT_STATUS: Record<string, DeliveryStatus> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.opened': 'read',
  'email.clicked': 'read',
  'email.bounced': 'bounced',
  'email.complained': 'failed',
  'email.failed': 'failed',
};

export async function POST(request: Request) {
  const secret = optionalEnv('RESEND_WEBHOOK_SECRET');
  const body = await request.text();

  if (!secret) {
    // Nothing to verify against. Refusing is the safe answer: accepting
    // unsigned callbacks would let anyone mark a guest's invitation as opened.
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const id = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signature = request.headers.get('svix-signature');

  if (!id || !timestamp || !signature) {
    return NextResponse.json({ error: 'unsigned' }, { status: 401 });
  }

  if (!verifySvixSignature({ secret, id, timestamp, signatureHeader: signature, body })) {
    return NextResponse.json({ error: 'bad_signature' }, { status: 401 });
  }

  let payload: { type?: string; data?: { email_id?: string } };
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  const type = payload.type ?? '';
  const providerMessageId = payload.data?.email_id;
  const status = EVENT_STATUS[type];

  // An event we do not track is not an error; acknowledge it so Resend stops
  // retrying.
  if (!status || !providerMessageId) return NextResponse.json({ ok: true });

  const admin = createAdminClient();

  const { data: deliveries } = await admin
    .from('message_deliveries')
    .select('id, status, kind, contact_id, event_id')
    .eq('provider_message_id', providerMessageId);

  for (const delivery of deliveries ?? []) {
    if (RANK[status] <= RANK[delivery.status]) continue;

    await admin
      .from('message_deliveries')
      .update({
        status,
        error: type === 'email.complained' ? 'complained' : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', delivery.id);

    // An opened invitation is part of the funnel the organiser watches, so it
    // is recorded on the invitation as well as on the delivery row.
    if (status === 'read' && delivery.kind === 'invite' && delivery.contact_id) {
      await admin
        .from('invitations')
        .update({ opened_at: new Date().toISOString() })
        .eq('event_id', delivery.event_id!)
        .eq('contact_id', delivery.contact_id)
        .is('opened_at', null);
    }
  }

  return NextResponse.json({ ok: true });
}
