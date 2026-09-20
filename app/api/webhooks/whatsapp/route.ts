import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { optionalEnv } from '@/lib/env';
import { verifyMetaSignature } from '@/lib/messaging/meta-webhook';
import type { Database } from '@/lib/db/types';

type DeliveryStatus = Database['public']['Enums']['delivery_status'];

/**
 * WhatsApp delivery statuses and inbound messages — BUILD-SPEC §7.5.
 *
 * Two verbs. GET is Meta's one-time handshake when the URL is registered:
 * it sends `hub.verify_token` and expects `hub.challenge` echoed back as
 * text. POST carries status updates for messages this platform sent, and any
 * message a guest sends to the number — which matters, because a guest
 * messaging the number is what opens the 24-hour free-form window the demo
 * depends on (§11b). The inbound message itself is not stored; only that a
 * number wrote in, and when.
 *
 * The URL has to be public. Meta cannot reach a laptop, so this runs on Vercel
 * or behind a `cloudflared` tunnel (README).
 */

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  const expected = optionalEnv('WHATSAPP_VERIFY_TOKEN');

  if (!expected) return new NextResponse('not_configured', { status: 503 });
  if (mode !== 'subscribe' || token !== expected || !challenge) {
    return new NextResponse('forbidden', { status: 403 });
  }

  return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

/** How far a status may move. A late `sent` must not undo a `read`. */
const RANK: Record<DeliveryStatus, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  bounced: 4,
  failed: 4,
};

const META_STATUS: Record<string, DeliveryStatus> = {
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
};

type StatusUpdate = {
  id?: string;
  status?: string;
  errors?: { code?: number; title?: string; message?: string }[];
};

type InboundMessage = { from?: string; id?: string; timestamp?: string; type?: string };

type WebhookBody = {
  object?: string;
  entry?: {
    changes?: {
      field?: string;
      value?: { statuses?: StatusUpdate[]; messages?: InboundMessage[] };
    }[];
  }[];
};

export async function POST(request: Request) {
  const appSecret = optionalEnv('WHATSAPP_APP_SECRET');
  const body = await request.text();

  if (!appSecret) {
    // Nothing to verify against. Refusing is the safe answer: accepting an
    // unsigned callback would let anyone mark a guest's message as delivered.
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const signature = request.headers.get('x-hub-signature-256');
  if (!verifyMetaSignature({ appSecret, signatureHeader: signature, body })) {
    return NextResponse.json({ error: 'bad_signature' }, { status: 401 });
  }

  let payload: WebhookBody;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  const admin = createAdminClient();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};

      for (const update of value.statuses ?? []) {
        const status = update.status ? META_STATUS[update.status] : undefined;
        if (!status || !update.id) continue;

        const { data: deliveries } = await admin
          .from('message_deliveries')
          .select('id, status')
          .eq('provider_message_id', update.id);

        for (const delivery of deliveries ?? []) {
          if (RANK[status] <= RANK[delivery.status]) continue;

          const reason = update.errors?.[0];
          await admin
            .from('message_deliveries')
            .update({
              status,
              error:
                status === 'failed'
                  ? (reason?.title ?? reason?.message ?? `meta_${reason?.code ?? 'failed'}`)
                  : null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', delivery.id);
        }
      }

      // A guest wrote to the number. The content stays with Meta; the record
      // here is only that the window opened, so the desk can tell "no window"
      // from "not delivered" later.
      for (const message of value.messages ?? []) {
        if (!message.from) continue;
        await admin.rpc('log_audit', {
          p_actor_id: null as unknown as string,
          p_action: 'whatsapp.inbound',
          p_entity: 'contacts',
          p_metadata: {
            wa_id: message.from,
            timestamp: message.timestamp ?? null,
            type: message.type ?? null,
          },
        });
      }
    }
  }

  // Meta retries anything that is not a 200, and a retried status update
  // would be harmless but noisy. Once verified, always acknowledge.
  return NextResponse.json({ ok: true });
}
