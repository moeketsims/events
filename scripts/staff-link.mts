/**
 * Mint a one-time staff sign-in link — for the hosted project, where the
 * seeded staff addresses are on the fictitious `@demo.cut-events.test` domain
 * and no email can ever arrive, and for local review after a reseed.
 *
 *   pnpm tsx scripts/staff-link.mts                      # organiser, hosted
 *   pnpm tsx scripts/staff-link.mts door@demo.cut-events.test
 *   pnpm tsx scripts/staff-link.mts --local              # against the Docker stack
 *
 * Each link signs in once and is then spent. Run it again for another.
 * It prints to your terminal; nothing is written to disk.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const local = args.includes('--local');
const email = args.find((a) => a.includes('@')) ?? 'organiser@demo.cut-events.test';

function read(file: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(file, 'utf8')
        .split('\n')
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
    );
  } catch {
    return {};
  }
}

const env = local ? read('.env.local') : read('.deploy/secrets.env');
const url = local
  ? env.NEXT_PUBLIC_SUPABASE_URL
  : `https://${env.SUPABASE_PROJECT_REF}.supabase.co`;
const key = env.SUPABASE_SECRET_KEY;
const appUrl = local
  ? (env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')
  : 'https://cut-events.vercel.app';

if (!url || !key) {
  console.error(
    local
      ? 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local.'
      : 'Missing SUPABASE_PROJECT_REF or SUPABASE_SECRET_KEY in .deploy/secrets.env.',
  );
  process.exit(1);
}

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email });

if (error) {
  console.error(`Could not mint a link for ${email}: ${error.message}`);
  process.exit(1);
}

const hash = data.properties?.hashed_token;
console.log(`\n  ${email}  (${local ? 'local stack' : 'hosted project'})`);
console.log(`  ${appUrl}/auth/confirm?token_hash=${hash}&type=magiclink&next=/dashboard\n`);
console.log('  Signs in once, then it is spent. Run this again for another.\n');
