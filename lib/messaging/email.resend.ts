import 'server-only';

import { optionalEnv } from '@/lib/env';
import type { ProviderResult, RenderedMessage } from './types';

/**
 * Resend — BUILD-SPEC §8.
 *
 * Free tier without a verified sending domain delivers only to the address that
 * owns the Resend account, and `onboarding@resend.dev` is the only From it will
 * accept. For the POC that is enough: the demo guests are `+` aliases of the
 * owner's own Gmail, which are distinct addresses to the database's unique
 * index and all land in one inbox.
 */

const ENDPOINT = 'https://api.resend.com/emails';

export function isConfigured(): boolean {
  return Boolean(optionalEnv('RESEND_API_KEY') && optionalEnv('EMAIL_FROM'));
}

export async function sendEmail(input: {
  to: string;
  message: RenderedMessage;
  kind: string;
}): Promise<ProviderResult> {
  const apiKey = optionalEnv('RESEND_API_KEY');
  const from = optionalEnv('EMAIL_FROM');

  if (!apiKey || !from) {
    return { status: 'failed', error: 'not_configured' };
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.message.subject,
        html: input.message.html,
        text: input.message.text,
        // Tagged so the delivery webhook and the Resend dashboard can tell an
        // invitation from a pass from a broadcast.
        tags: [{ name: 'kind', value: input.kind }],
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      id?: string;
      message?: string;
      name?: string;
    } | null;

    if (!response.ok) {
      return {
        status: 'failed',
        error: payload?.message ?? `resend_${response.status}`,
      };
    }

    return { status: 'sent', providerMessageId: payload?.id };
  } catch (error) {
    return { status: 'failed', error: messageOf(error) };
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown_error';
}
