/**
 * Put real staff back in their department after a reseed.
 *
 *   pnpm tsx scripts/reattach-staff.mts [--local]
 *
 * `teardown()` in the seed sets `department_id = null` on every profile in the
 * demo department, because it deletes and rebuilds that department and must not
 * orphan an auth account. It then re-attaches only the three fictitious staff
 * it creates itself. Anyone real — Institutional Advancement staff added with
 * scripts/add-staff.mts — is left detached, which silently strips their access:
 * RLS scopes the whole console by department.
 *
 * This finds every profile with no department and an address that is not one of
 * the seed's own, and attaches it to the rebuilt department, keeping its role.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const local = process.argv.includes('--local');

/** The seed owns these; it re-attaches them itself. */
const SEEDED = /@demo\.cut-events\.test$/i;

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

if (!url || !key) {
  console.error('Missing Supabase URL or secret key for the chosen target.');
  process.exit(1);
}

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: departments } = await db.from('departments').select('id, name');
if (!departments?.length) {
  console.error('No department exists to attach anyone to. Run the seed first.');
  process.exit(1);
}
if (departments.length > 1) {
  console.error('More than one department exists; this script does not know which to use.');
  process.exit(1);
}
const department = departments[0]!;

const { data: detached, error } = await db
  .from('profiles')
  .select('id, email, role')
  .is('department_id', null);

if (error) {
  console.error(`Could not read profiles: ${error.message}`);
  process.exit(1);
}

const real = (detached ?? []).filter((p) => p.email && !SEEDED.test(p.email));

if (real.length === 0) {
  console.log('  No real staff were left detached.');
  process.exit(0);
}

for (const person of real) {
  const { error: attachError } = await db
    .from('profiles')
    .update({ department_id: department.id })
    .eq('id', person.id);
  console.log(
    attachError
      ? `  FAILED  ${person.email}: ${attachError.message}`
      : `  attached ${person.email} (${person.role}) to ${department.name}`,
  );
}
