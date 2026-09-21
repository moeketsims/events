/**
 * Add a real member of staff to the platform — BUILD-SPEC §5, TASKS T1.4.
 *
 *   pnpm tsx scripts/add-staff.mts qsompondo@cut.ac.za "Qondakele Sompondo" organiser
 *   pnpm tsx scripts/add-staff.mts someone@cut.ac.za "Full Name" door_staff --local
 *
 * Roles: organiser | door_staff | auction_operator | finance | platform_admin
 *
 * Mirrors `seedStaff` in supabase/seed/seed.ts: create the auth account with
 * the address already confirmed, then set the profile's department, role and
 * name. Re-running for the same address adopts the existing account rather
 * than failing, so it is safe to use to change someone's role.
 *
 * It deliberately does NOT print a sign-in link. Mint one separately with
 * `pnpm tsx scripts/staff-link.mts <email>` so the credential is created at the
 * moment it is sent, not left in a terminal scrollback.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const ROLES = ['organiser', 'door_staff', 'auction_operator', 'finance', 'platform_admin'];

const args = process.argv.slice(2);
const local = args.includes('--local');
const positional = args.filter((a) => !a.startsWith('--'));
const [email, fullName, role = 'organiser'] = positional;

if (!email || !fullName) {
  console.error('Usage: pnpm tsx scripts/add-staff.mts <email> "<Full Name>" [role] [--local]');
  console.error(`Roles: ${ROLES.join(' | ')}`);
  process.exit(1);
}
if (!ROLES.includes(role)) {
  console.error(`"${role}" is not a role. Use one of: ${ROLES.join(' | ')}`);
  process.exit(1);
}

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

const { data: departments, error: deptError } = await db.from('departments').select('id, name');
if (deptError || !departments?.length) {
  console.error(`No department to add them to: ${deptError?.message ?? 'none exist'}`);
  process.exit(1);
}
if (departments.length > 1) {
  console.error('More than one department exists; this script does not know which to use.');
  process.exit(1);
}
const department = departments[0]!;

const address = email.toLowerCase();
let userId: string | undefined;
let created = false;

const { data: made, error: createError } = await db.auth.admin.createUser({
  email: address,
  email_confirm: true,
  user_metadata: { full_name: fullName },
});

if (made?.user) {
  userId = made.user.id;
  created = true;
} else {
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  userId = list?.users.find((u) => u.email?.toLowerCase() === address)?.id;
  if (!userId) {
    console.error(`Could not create or find ${address}: ${createError?.message}`);
    process.exit(1);
  }
}

// A trigger creates the profile row with the account, so this is normally an
// update; the insert covers a project where that trigger has not run.
const profile = { department_id: department.id, role, full_name: fullName, email: address };
const { data: updated, error: updateError } = await db
  .from('profiles')
  .update(profile)
  .eq('id', userId)
  .select('id');

if (updateError) {
  console.error(`Could not set the profile: ${updateError.message}`);
  process.exit(1);
}
if (!updated?.length) {
  const { error: insertError } = await db.from('profiles').insert({ id: userId, ...profile });
  if (insertError) {
    console.error(`Could not create the profile: ${insertError.message}`);
    process.exit(1);
  }
}

await db.rpc('log_audit', {
  p_actor_id: null as unknown as string,
  p_action: created ? 'profile.created' : 'profile.role_changed',
  p_entity: 'profiles',
  p_entity_id: userId,
  p_metadata: { email: address, role, via: 'scripts/add-staff.mts' },
});

console.log(`\n  ${created ? 'Created' : 'Updated'}  ${fullName} <${address}>`);
console.log(`  Role      ${role.replace('_', ' ')}`);
console.log(`  Dept      ${department.name}`);
console.log(`  Target    ${local ? 'local stack' : url}`);
console.log(`\n  Send them a sign-in link with:`);
console.log(`    pnpm tsx scripts/staff-link.mts ${address}\n`);
