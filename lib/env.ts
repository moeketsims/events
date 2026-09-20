/**
 * Environment access. Public values are read directly so Next can inline them
 * at build time; server-only values go through `serverEnv` which throws a
 * readable error instead of failing deep inside a provider call.
 */

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/** `broadcast` (default) or `poll` — see BUILD-SPEC §4.6 fallback. */
export const REALTIME_MODE: 'broadcast' | 'poll' =
  process.env.NEXT_PUBLIC_REALTIME_MODE === 'poll' ? 'poll' : 'broadcast';

/** South African Standard Time. Every rendered date uses this zone. */
export const TIME_ZONE = 'Africa/Johannesburg';

type ServerVar =
  | 'SUPABASE_SECRET_KEY'
  | 'PASS_SIGNING_SECRET'
  | 'CRON_SECRET'
  | 'EMAIL_PROVIDER'
  | 'EMAIL_FROM'
  | 'RESEND_API_KEY'
  | 'RESEND_WEBHOOK_SECRET'
  | 'BREVO_API_KEY'
  | 'WHATSAPP_PHONE_NUMBER_ID'
  | 'WHATSAPP_ACCESS_TOKEN'
  | 'WHATSAPP_VERIFY_TOKEN'
  | 'WHATSAPP_APP_SECRET'
  | 'YOCO_SECRET_KEY'
  | 'YOCO_WEBHOOK_SECRET'
  | 'SENTRY_DSN';

/** Returns the value or `undefined`; callers decide whether it is fatal. */
export function optionalEnv(name: ServerVar): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

/** Returns the value or throws — use where the request cannot proceed without it. */
export function serverEnv(name: ServerVar): string {
  const value = optionalEnv(name);
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Add it to .env.local (see .env.example).`,
    );
  }
  return value;
}
