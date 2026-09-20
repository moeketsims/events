import 'server-only';

import { optionalEnv } from '@/lib/env';
import type { ProviderResult } from './types';

/**
 * WhatsApp through the Meta Cloud API, called directly — BUILD-SPEC §8.
 *
 * Two constraints shape everything here, and both are lifted by a production
 * number rather than by code:
 *
 *  - the test number will only message the (up to five) recipients registered
 *    in the Meta dashboard; anything else comes back as a 131030-class error;
 *  - free-form text is delivered only inside the 24-hour window opened by that
 *    recipient messaging the number first. Outside it, Meta requires an
 *    approved template. The demo procedure therefore has every demo phone send
 *    "Hi" beforehand (04-DEMO-SCRIPT.md), and Meta's own error text is stored
 *    on the delivery row so the reason is visible rather than guessed at.
 */

const GRAPH_VERSION = 'v21.0';

export function isConfigured(): boolean {
  return Boolean(optionalEnv('WHATSAPP_PHONE_NUMBER_ID') && optionalEnv('WHATSAPP_ACCESS_TOKEN'));
}

/** Meta wants the number without a leading `+`. */
export function toWhatsAppNumber(phoneE164: string): string {
  return phoneE164.replace(/[^0-9]/g, '');
}

type Payload =
  { type: 'text'; body: string } | { type: 'image'; imageUrl: string; caption?: string };

export async function sendWhatsApp(input: {
  to: string;
  payload: Payload;
}): Promise<ProviderResult> {
  const phoneNumberId = optionalEnv('WHATSAPP_PHONE_NUMBER_ID');
  const token = optionalEnv('WHATSAPP_ACCESS_TOKEN');

  if (!phoneNumberId || !token) {
    return { status: 'failed', error: 'not_configured' };
  }

  const body =
    input.payload.type === 'text'
      ? {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: toWhatsAppNumber(input.to),
          type: 'text',
          text: { preview_url: true, body: input.payload.body },
        }
      : {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: toWhatsAppNumber(input.to),
          type: 'image',
          image: { link: input.payload.imageUrl, caption: input.payload.caption },
        };

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    const payload = (await response.json().catch(() => null)) as {
      messages?: { id: string }[];
      error?: { message?: string; code?: number; error_subcode?: number };
    } | null;

    if (!response.ok || payload?.error) {
      const error = payload?.error;
      return {
        status: 'failed',
        error: error?.message
          ? `${error.message}${error.code ? ` (${error.code})` : ''}`
          : `meta_${response.status}`,
      };
    }

    return { status: 'sent', providerMessageId: payload?.messages?.[0]?.id };
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : 'unknown_error' };
  }
}
