import 'server-only';

import type { ProviderResult } from './types';

/**
 * SMS is Stage B — PLAN.md §6.2 B1. No South African route has a free tier, so
 * the POC records the attempt and stops.
 *
 * The seam exists rather than the provider: a broadcast may target SMS, the
 * delivery row is written, and it reads `failed / not_configured` instead of
 * silently disappearing. Adding Clickatell or BulkSMS later is this file and
 * nothing else.
 */
export async function sendSms(_input: { to: string; body: string }): Promise<ProviderResult> {
  return { status: 'failed', error: 'not_configured' };
}
