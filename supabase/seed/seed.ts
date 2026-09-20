/**
 * Demo data for the CUT Events proof of concept. BUILD-SPEC §11.
 *
 *   pnpm seed
 *
 * Idempotent: it tears its own department down and rebuilds it, so running it
 * twice leaves exactly one of everything. It touches nothing outside the
 * `demo` department, so it is safe to run against a project that also holds
 * other departments' work.
 *
 * Every bid it creates goes through place_bid(), the same function the bidding
 * page calls. The seed has no shortcut into the ledger, because there isn't
 * one — 0005_rls.sql gives `bids` no insert policy at all.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import type { Database } from '../../lib/db/types';
import { signToken } from '../../lib/auth/pass';
import { bidStep, formatZAR, type IncrementRow } from '../../lib/money';
import { AUCTION_CLOSES_AT, CONTACTS, DEPARTMENT, EVENT, LOTS, SPLIT, STAFF } from './data';

loadEnv({ path: '.env.local', quiet: true });

const HERE = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

if (!SUPABASE_URL || !SECRET_KEY) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.\n' +
      'Put them in .env.local. For a local stack, `supabase start` prints both.',
  );
  process.exit(1);
}

if (!process.env.PASS_SIGNING_SECRET) {
  console.error(
    'Missing PASS_SIGNING_SECRET. Passes are signed with it, and seeding without\n' +
      'one would issue tokens that no running app can verify.',
  );
  process.exit(1);
}

type Db = SupabaseClient<Database>;

const db: Db = createClient<Database>(SUPABASE_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Deterministic pseudo-random, so two seed runs produce the same demo. */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}
const random = makeRandom(20261030);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]!;
}

function die(step: string, error: { message: string } | null): void {
  if (error) {
    console.error(`\n  ✗ ${step}: ${error.message}\n`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// 1. Tear down the previous demo
// ---------------------------------------------------------------------------

async function teardown(): Promise<void> {
  const { data: dept } = await db
    .from('departments')
    .select('id')
    .eq('slug', DEPARTMENT.slug)
    .maybeSingle();

  if (!dept) return;

  const { data: events } = await db.from('events').select('id').eq('department_id', dept.id);
  const eventIds = (events ?? []).map((e) => e.id);

  if (eventIds.length > 0) {
    const { data: auctions } = await db.from('auctions').select('id').in('event_id', eventIds);
    const auctionIds = (auctions ?? []).map((a) => a.id);

    if (auctionIds.length > 0) {
      const { data: lots } = await db.from('lots').select('id').in('auction_id', auctionIds);
      const lotIds = (lots ?? []).map((l) => l.id);

      // Explicit order rather than relying on ON DELETE CASCADE: bids and
      // settlements reference attendees without a cascade, so deleting the
      // event first can fail depending on the order Postgres unwinds the tree.
      if (lotIds.length > 0) {
        await db.from('bids').delete().in('lot_id', lotIds);
        await db.from('settlements').delete().in('lot_id', lotIds);
        await db.from('lots').delete().in('id', lotIds);
      }
      await db.from('auctions').delete().in('id', auctionIds);
    }

    await db.from('message_deliveries').delete().in('event_id', eventIds);
    await db.from('broadcasts').delete().in('event_id', eventIds);
    await db.from('attendees').delete().in('event_id', eventIds);

    const { data: invitations } = await db
      .from('invitations')
      .select('id')
      .in('event_id', eventIds);
    const invitationIds = (invitations ?? []).map((i) => i.id);
    if (invitationIds.length > 0) {
      await db.from('rsvps').delete().in('invitation_id', invitationIds);
      await db.from('invitations').delete().in('id', invitationIds);
    }

    await db.from('event_questions').delete().in('event_id', eventIds);
    await db.from('events').delete().in('id', eventIds);
  }

  const { data: contacts } = await db.from('contacts').select('id').eq('department_id', dept.id);
  const contactIds = (contacts ?? []).map((c) => c.id);
  if (contactIds.length > 0) {
    await db.from('consents').delete().in('contact_id', contactIds);
    await db.from('contacts').delete().in('id', contactIds);
  }

  // Staff profiles are detached rather than deleted: the auth users are reused
  // below, and deleting a profile row would orphan the auth account.
  await db.from('profiles').update({ department_id: null }).eq('department_id', dept.id);
  await db.from('departments').delete().eq('id', dept.id);
}

// ---------------------------------------------------------------------------
// 2. Department and staff
// ---------------------------------------------------------------------------

async function seedDepartment(): Promise<string> {
  const { data, error } = await db
    .from('departments')
    .insert({ name: DEPARTMENT.name, slug: DEPARTMENT.slug })
    .select('id')
    .single();
  die('create department', error);
  return data!.id;
}

async function seedStaff(departmentId: string): Promise<{ email: string; magicLink?: string }[]> {
  const results: { email: string; magicLink?: string }[] = [];

  for (const person of STAFF) {
    const { data: created, error } = await db.auth.admin.createUser({
      email: person.email,
      email_confirm: true,
      user_metadata: { full_name: person.fullName },
    });

    let userId = created?.user?.id;

    if (error) {
      // Already there from an earlier run; reuse the account.
      const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
      userId = list?.users.find((u) => u.email?.toLowerCase() === person.email)?.id;
      if (!userId) die(`create staff user ${person.email}`, error);
    }

    const { error: profileError } = await db
      .from('profiles')
      .update({
        department_id: departmentId,
        role: person.role,
        full_name: person.fullName,
        email: person.email,
      })
      .eq('id', userId!);
    die(`set up profile for ${person.email}`, profileError);

    // Printed because the free-tier auth mailer is rate-limited and custom SMTP
    // may not be configured yet (BUILD-SPEC §4.9). This is the fallback way in.
    //
    // The link is built from `hashed_token` and pointed at our own
    // /auth/confirm route rather than using `action_link`. Supabase's own
    // verify URL hands the session back in the URL fragment, which a server
    // component cannot read, so following it lands on /login with no session
    // and no explanation.
    const { data: link } = await db.auth.admin.generateLink({
      type: 'magiclink',
      email: person.email,
      options: { redirectTo: `${APP_URL}/dashboard` },
    });

    const hashedToken = link?.properties?.hashed_token;
    results.push({
      email: person.email,
      magicLink: hashedToken
        ? `${APP_URL}/auth/confirm?token_hash=${hashedToken}&type=magiclink&next=/dashboard`
        : undefined,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// 3. Contacts
// ---------------------------------------------------------------------------

/**
 * Where the demo guests' messages actually land.
 *
 * Fictitious contacts are `@example.com`, which RFC 2606 reserves and nothing
 * delivers to — the rule in CLAUDE.md that no real personal data enters the
 * system. But a demo has to show an invitation *arriving*, and Resend's free
 * tier with no verified domain delivers only to the address that owns the
 * account. `DEMO_EMAIL_BASE=someone@gmail.com` therefore gives the first few
 * guests `someone+naledi@gmail.com`: a distinct address to the database's
 * unique index, and one inbox to put on the projector. Set `DEMO_PHONES` to
 * the numbers registered as WhatsApp test recipients and the same guests
 * become reachable on WhatsApp.
 */
const DEMO_EMAIL_BASE = process.env.DEMO_EMAIL_BASE?.trim();
const DEMO_PHONES = (process.env.DEMO_PHONES ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

/** How many of the seeded guests are wired to real addresses. */
const DEMO_GUESTS = Math.max(DEMO_EMAIL_BASE ? 5 : 0, DEMO_PHONES.length);

function clean(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');
}

function emailFor(first: string, last: string, index: number): string {
  if (DEMO_EMAIL_BASE && index < DEMO_GUESTS) {
    const [local, domain] = DEMO_EMAIL_BASE.split('@');
    if (local && domain) return `${local}+${clean(first)}@${domain}`;
  }
  return `${clean(first)}.${clean(last)}@example.com`;
}

async function seedContacts(
  departmentId: string,
): Promise<{ id: string; email: string; firstName: string; lastName: string; phone: string }[]> {
  const rows = CONTACTS.map((c, i) => ({
    department_id: departmentId,
    first_name: c.firstName,
    last_name: c.lastName,
    email: emailFor(c.firstName, c.lastName, i),
    // The +27 82 000 00xx block: fictitious, and never dialled by the POC.
    // A number from DEMO_PHONES replaces it for the demo guests, and those
    // guests are opted in, because a phone registered as a WhatsApp test
    // recipient has already agreed to be messaged.
    phone_e164: DEMO_PHONES[i] ?? `+27820000${String(i + 1).padStart(3, '0')}`,
    whatsapp_opt_in: i < DEMO_PHONES.length || i % 3 !== 0,
    organisation: c.organisation ?? null,
    title: c.title ?? null,
    tags: c.tags,
    alumni_year: c.alumniYear ?? null,
    donor_tier: c.donorTier ?? null,
  }));

  const { data, error } = await db
    .from('contacts')
    .insert(rows)
    .select('id, email, first_name, last_name, phone_e164');
  die('create contacts', error);

  return data!.map((c) => ({
    id: c.id,
    email: c.email!,
    firstName: c.first_name,
    lastName: c.last_name,
    phone: c.phone_e164!,
  }));
}

// ---------------------------------------------------------------------------
// 4. Event, invitations, RSVPs, attendees
// ---------------------------------------------------------------------------

async function seedEvent(departmentId: string, organiserId: string | null): Promise<string> {
  const { data, error } = await db
    .from('events')
    .insert({
      department_id: departmentId,
      title: EVENT.title,
      slug: EVENT.slug,
      description: EVENT.description,
      starts_at: EVENT.startsAt,
      ends_at: EVENT.endsAt,
      venue_name: EVENT.venueName,
      venue_address: EVENT.venueAddress,
      capacity: EVENT.capacity,
      rsvp_deadline: EVENT.rsvpDeadline,
      allow_plus_ones: true,
      auction_enabled: true,
      status: 'published',
      created_by: organiserId,
    })
    .select('id')
    .single();
  die('create event', error);

  const { error: questionError } = await db.from('event_questions').insert([
    {
      event_id: data!.id,
      label: 'Dietary requirements',
      type: 'select',
      options: ['None', 'Vegetarian', 'Halaal', 'Kosher', 'Other'],
      required: false,
      sort_order: 1,
    },
    {
      event_id: data!.id,
      label: 'Do you need step-free access?',
      type: 'boolean',
      required: false,
      sort_order: 2,
    },
  ]);
  die('create event questions', questionError);

  return data!.id;
}

type Attendee = { id: string; passToken: string; displayName: string; contactId: string };

async function seedInvitations(
  eventId: string,
  contacts: Awaited<ReturnType<typeof seedContacts>>,
): Promise<Attendee[]> {
  // Insert invitations with a placeholder token, then sign each one with its
  // own row id. The token has to carry the id, and the id only exists once the
  // row does.
  const { data: inserted, error } = await db
    .from('invitations')
    .insert(
      contacts.map((c, i) => ({
        event_id: eventId,
        contact_id: c.id,
        token: `pending-${i}-${Date.now()}`,
      })),
    )
    .select('id, contact_id');
  die('create invitations', error);

  const invitations = inserted!;

  for (const invitation of invitations) {
    const { error: tokenError } = await db
      .from('invitations')
      .update({ token: signToken('r', invitation.id) })
      .eq('id', invitation.id);
    die('sign invitation token', tokenError);
  }

  const accepted = invitations.slice(0, SPLIT.accepted);
  const declined = invitations.slice(SPLIT.accepted, SPLIT.accepted + SPLIT.declined);
  // The remaining SPLIT.pending stay 'pending' with no rsvp row.

  const byContact = new Map(contacts.map((c) => [c.id, c]));
  const attendees: Attendee[] = [];

  // Accepted: status, an rsvp row, a consent row, and one attendee per seat.
  for (const [index, invitation] of accepted.entries()) {
    const contact = byContact.get(invitation.contact_id)!;
    // Every fourth acceptance brings a plus-one, so the demo has both shapes.
    const guestCount = index % 4 === 3 ? 2 : 1;

    const { error: rsvpError } = await db.from('rsvps').insert({
      invitation_id: invitation.id,
      attending: true,
      guest_count: guestCount,
      whatsapp_opt_in: index % 3 !== 0,
      answers: { 'Dietary requirements': pick(['None', 'None', 'Vegetarian', 'Halaal']) },
    });
    die('create rsvp', rsvpError);

    const { error: statusError } = await db
      .from('invitations')
      .update({
        status: 'accepted',
        responded_at: new Date().toISOString(),
        first_sent_at: new Date().toISOString(),
        sent_via: ['email'],
      })
      .eq('id', invitation.id);
    die('mark invitation accepted', statusError);

    const { error: consentError } = await db.from('consents').insert({
      contact_id: contact.id,
      purpose: 'event_comms',
      channel: 'email',
      wording_version: 'v1',
      source: 'rsvp_form',
    });
    die('create consent', consentError);

    for (let seat = 0; seat < guestCount; seat += 1) {
      const isPlusOne = seat > 0;
      const displayName = isPlusOne
        ? `Guest of ${contact.firstName} ${contact.lastName}`
        : `${contact.firstName} ${contact.lastName}`;

      const { data: attendee, error: attendeeError } = await db
        .from('attendees')
        .insert({
          event_id: eventId,
          contact_id: isPlusOne ? null : contact.id,
          invitation_id: invitation.id,
          display_name: displayName,
          is_plus_one: isPlusOne,
          pass_token: `pending-${invitation.id}-${seat}`,
        })
        .select('id')
        .single();
      die('create attendee', attendeeError);

      const passToken = signToken('p', attendee!.id);
      const { error: tokenError } = await db
        .from('attendees')
        .update({ pass_token: passToken })
        .eq('id', attendee!.id);
      die('sign pass token', tokenError);

      attendees.push({
        id: attendee!.id,
        passToken,
        displayName,
        contactId: contact.id,
      });
    }
  }

  // Declined.
  for (const invitation of declined) {
    const { error: rsvpError } = await db.from('rsvps').insert({
      invitation_id: invitation.id,
      attending: false,
      guest_count: 1,
    });
    die('create declined rsvp', rsvpError);

    const { error: statusError } = await db
      .from('invitations')
      .update({
        status: 'declined',
        responded_at: new Date().toISOString(),
        first_sent_at: new Date().toISOString(),
        sent_via: ['email'],
      })
      .eq('id', invitation.id);
    die('mark invitation declined', statusError);
  }

  return attendees;
}

/**
 * Check the first twelve attendees in through the same function the scanner
 * calls, so they get bidder numbers 1..12 the way a real arrival would.
 */
async function checkInEarlyArrivals(attendees: Attendee[], doorStaffId: string | null) {
  const arrivals = attendees.slice(0, SPLIT.checkedIn);

  for (const attendee of arrivals) {
    const { error } = await db.rpc('check_in_attendee', {
      p_attendee_id: attendee.id,
      // The generated signature types p_staff_id as string, but the column is
      // nullable and the function accepts null — check_in_attendee only records
      // it on the attendee row.
      p_staff_id: doorStaffId as string,
    });
    die(`check in ${attendee.displayName}`, error);
  }

  return arrivals;
}

// ---------------------------------------------------------------------------
// 5. Auction, lots and bids
// ---------------------------------------------------------------------------

async function uploadLotImage(fileName: string): Promise<string> {
  const bytes = await readFile(join(HERE, 'lots', fileName));
  const { error } = await db.storage
    .from('lot-images')
    .upload(fileName, bytes, { contentType: 'image/jpeg', upsert: true });

  if (error) {
    console.warn(`  ! could not upload ${fileName}: ${error.message}`);
    return '';
  }

  return db.storage.from('lot-images').getPublicUrl(fileName).data.publicUrl;
}

async function seedAuction(eventId: string) {
  const { data: auction, error } = await db
    .from('auctions')
    .insert({
      event_id: eventId,
      mode: 'silent',
      title: 'CUT Gala Silent Auction',
      opens_at: EVENT.startsAt,
      closes_at: AUCTION_CLOSES_AT,
      soft_close_seconds: 120,
    })
    .select('id, display_key, increment_table')
    .single();
  die('create auction', error);

  const lotRows = [];
  for (const lot of LOTS) {
    const imageUrl = await uploadLotImage(lot.image);
    lotRows.push({
      auction_id: auction!.id,
      lot_number: lot.lotNumber,
      title: lot.title,
      description: lot.description,
      donor_name: lot.donorName,
      starting_bid: lot.startingBid,
      reserve: lot.reserve ?? null,
      images: imageUrl ? [imageUrl] : [],
      // Every lot opens, so the board is live the moment the demo starts.
      status: 'open' as const,
      opens_at: EVENT.startsAt,
      closes_at: AUCTION_CLOSES_AT,
      sort_order: lot.lotNumber,
    });
  }

  const { data: lots, error: lotError } = await db
    .from('lots')
    .insert(lotRows)
    .select('id, lot_number, starting_bid');
  die('create lots', lotError);

  return { auction: auction!, lots: lots! };
}

async function seedBids(
  lots: { id: string; lot_number: number; starting_bid: number }[],
  incrementTable: IncrementRow[],
  bidders: Attendee[],
) {
  let placed = 0;

  for (const lot of lots) {
    const spec = LOTS.find((l) => l.lotNumber === lot.lot_number)!;
    let current: number | null = null;

    for (let i = 0; i < spec.seedBids; i += 1) {
      // Never the same bidder twice in a row, so every lot has a real contest
      // and the "Outbid" state is reachable on the demo phones.
      const bidder = bidders[(lot.lot_number * 3 + i * 5) % bidders.length]!;
      const amount: number =
        current === null ? Number(lot.starting_bid) : current + bidStep(incrementTable, current);

      const { data, error } = await db.rpc('place_bid', {
        p_lot_id: lot.id,
        p_attendee_id: bidder.id,
        p_amount: amount,
      });
      die(`place seed bid on lot ${lot.lot_number}`, error);

      const result = data?.[0];
      if (result?.result !== 'ok') {
        console.warn(`  ! lot ${lot.lot_number} bid of ${formatZAR(amount)}: ${result?.result}`);
        break;
      }

      current = amount;
      placed += 1;
    }
  }

  return placed;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function main() {
  const started = Date.now();
  const isLocalStack = /127\.0\.0\.1|localhost/.test(SUPABASE_URL!);
  console.log(`\nSeeding ${SUPABASE_URL}${isLocalStack ? ' (local stack)' : ''}\n`);

  process.stdout.write('  clearing the previous demo … ');
  await teardown();
  console.log('done');

  process.stdout.write('  department and staff … ');
  const departmentId = await seedDepartment();
  const staff = await seedStaff(departmentId);
  const { data: profiles } = await db
    .from('profiles')
    .select('id, role')
    .eq('department_id', departmentId);
  const organiserId = profiles?.find((p) => p.role === 'organiser')?.id ?? null;
  const doorStaffId = profiles?.find((p) => p.role === 'door_staff')?.id ?? null;
  console.log(`${staff.length} users`);

  process.stdout.write('  contacts … ');
  const contacts = await seedContacts(departmentId);
  console.log(`${contacts.length}`);

  process.stdout.write('  event … ');
  const eventId = await seedEvent(departmentId, organiserId);
  console.log(EVENT.title);

  process.stdout.write('  invitations, RSVPs and passes … ');
  const attendees = await seedInvitations(eventId, contacts);
  console.log(
    `${SPLIT.accepted} accepted, ${SPLIT.declined} declined, ${SPLIT.pending} pending, ${attendees.length} passes`,
  );

  process.stdout.write('  early arrivals … ');
  const arrivals = await checkInEarlyArrivals(attendees, doorStaffId);
  console.log(`${arrivals.length} checked in, bidder numbers 1–${arrivals.length}`);

  process.stdout.write('  auction and lots … ');
  const { auction, lots } = await seedAuction(eventId);
  console.log(`${lots.length} lots`);

  process.stdout.write('  opening bids … ');
  const placed = await seedBids(
    lots.map((l) => ({ ...l, starting_bid: Number(l.starting_bid) })),
    auction.increment_table as unknown as IncrementRow[],
    arrivals,
  );
  console.log(`${placed} bids through place_bid()`);

  // ---- report -------------------------------------------------------------

  const { data: totals } = await db
    .from('auction_totals')
    .select('total_raised, lots_with_bids')
    .eq('auction_id', auction.id)
    .maybeSingle();

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const rule = '─'.repeat(72);

  console.log(`\n${rule}`);
  console.log(`  ${EVENT.title}`);
  console.log(`  Friday 30 October 2026, 18:00 · ${EVENT.venueName}`);
  console.log(
    `  On the board: ${formatZAR(Number(totals?.total_raised ?? 0))} across ${totals?.lots_with_bids ?? 0} of ${lots.length} lots`,
  );
  console.log(rule);

  console.log('\n  STAFF — each link signs in once and is then spent\n');
  for (const person of staff) {
    console.log(`  ${person.email}`);
    console.log(`    ${person.magicLink ?? '(no link generated)'}\n`);
  }

  // A spent link redirects to /login?error=link_expired, which now says so.
  // Print the non-expiring way in as well, so a used link is a detour rather
  // than a dead end.
  console.log(`  Or sign in at ${APP_URL}/login with any address above.`);
  console.log(
    isLocalStack
      ? '  The six-digit code is caught by Mailpit at http://127.0.0.1:54524\n'
      : '  The six-digit code is emailed; custom SMTP must be configured.\n',
  );

  if (DEMO_GUESTS > 0) {
    console.log('  REAL ADDRESSES — these guests can actually be messaged\n');
    for (const contact of contacts.slice(0, DEMO_GUESTS)) {
      console.log(`  ${contact.firstName} ${contact.lastName}  ${contact.email}  ${contact.phone}`);
    }
    console.log('');
  } else {
    console.log(
      '  Every guest is @example.com and +2782000000xx. Set DEMO_EMAIL_BASE and\n' +
        '  DEMO_PHONES in .env.local to make the first few reachable for a demo.\n',
    );
  }

  console.log('  ATTENDEE PASSES — open these on the demo phones\n');
  for (const attendee of arrivals.slice(0, 2)) {
    console.log(`  ${attendee.displayName} (checked in)`);
    console.log(`    ${APP_URL}/p/${attendee.passToken}\n`);
  }
  const notArrived = attendees[SPLIT.checkedIn];
  if (notArrived) {
    console.log(`  ${notArrived.displayName} (not yet through the door — scan this one)`);
    console.log(`    ${APP_URL}/p/${notArrived.passToken}\n`);
  }

  console.log('  PROJECTION — full-screen on the external display\n');
  console.log(`    ${APP_URL}/display/${auction.id}?k=${auction.display_key}\n`);

  console.log(`  Seeded in ${seconds}s.\n`);
}

main().catch((error) => {
  console.error('\nSeed failed:', error);
  process.exit(1);
});
