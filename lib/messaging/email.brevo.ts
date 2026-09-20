import 'server-only';

import { optionalEnv } from '@/lib/env';
import type { ProviderResult, RenderedMessage } from './types';

/**
 * Brevo — the fallback email provider named in BUILD-SPEC §8.
 *
 * Brevo needs only a verified *sender address*, not a whole domain, and allows
 * 300 messages a day on the free plan. That makes it the path of least
 * resistance when CUT ICT has not yet authenticated a sending domain. Only this
 * file and the `EMAIL_PROVIDER` variable change; nothing above the provider
 * boundary knows which one sent the message.
 */

const ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

export function isConfigured(): boolean {
  return Boolean(optionalEnv('BREVO_API_KEY') && optionalEnv('EMAIL_FROM'));
}

/** `CUT Events <events@example.com>` → `{ name, email }`, which Brevo wants. */
function parseFrom(from: string): { name?: string; email: string } {
  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (!match) return { email: from.trim() };
  return { name: match[1] || undefined, email: (match[2] ?? '').trim() };
}

export async function sendEmail(input: {
  to: string;
  message: RenderedMessage;
  kind: string;
}): Promise<ProviderResult> {
  const apiKey = optionalEnv('BREVO_API_KEY');
  const from = optionalEnv('EMAIL_FROM');

  if (!apiKey || !from) {
    return { status: 'failed', error: 'not_configured' };
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: parseFrom(from),
        to: [{ email: input.to }],
        subject: input.message.subject,
        htmlContent: input.message.html,
        textContent: input.message.text,
        tags: [input.kind],
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      messageId?: string;
      message?: string;
    } | null;

    if (!response.ok) {
      return { status: 'failed', error: payload?.message ?? `brevo_${response.status}` };
    }

    return { status: 'sent', providerMessageId: payload?.messageId };
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : 'unknown_error' };
  }
}
