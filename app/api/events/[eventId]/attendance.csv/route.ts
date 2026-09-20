import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { TIME_ZONE } from '@/lib/env';
import { csvFile, csvSlug } from '@/lib/csv';

/**
 * The attendance register as a CSV — the file that replaces the paper one.
 *
 * Times are rendered in `Africa/Johannesburg`, not UTC: an usher reading the
 * export the morning after should see 18:42, which is when the guest actually
 * walked in. Excel is the destination, so the file carries a BOM (without it
 * Excel reads UTF-8 as the system codepage and mangles every surname with a
 * diacritic) and CRLF line endings.
 */

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await context.params;
  const profile = await requireStaff(['organiser', 'finance', 'auction_operator']);

  const supabase = await createClient();

  // RLS first: if the organiser may not see the event, there is nothing to export.
  const { data: event } = await supabase
    .from('events')
    .select('id, title, starts_at')
    .eq('id', eventId)
    .maybeSingle();

  if (!event) return new Response('Not found', { status: 404 });

  // The join to contacts and to the scanner's profile needs to cross tables the
  // organiser can read but PostgREST will not embed under two RLS policies at
  // once, so the read itself is done with the admin client — after the check
  // above has established that this event belongs to the caller's department.
  const admin = createAdminClient();

  const { data: rows } = await admin
    .from('attendees')
    // One string literal, not a concatenation: the Supabase client infers the
    // row type from the literal, and `'a, ' + 'b'` gives it nothing to read.
    .select(
      'display_name, is_plus_one, is_walk_in, bidder_number, checked_in_at, checked_in_by, contacts(first_name, last_name, email, phone_e164, organisation), invitations(status)',
    )
    .eq('event_id', eventId)
    .order('checked_in_at', { ascending: true, nullsFirst: false })
    .order('display_name', { ascending: true });

  // The usher who scanned each guest, looked up separately: `attendees` has two
  // foreign keys into `profiles`-adjacent tables and PostgREST cannot embed the
  // aliased one without ambiguity. One extra query for a handful of staff.
  const scannerIds = [...new Set((rows ?? []).map((row) => row.checked_in_by).filter(Boolean))];
  const scanners = new Map<string, string>();

  if (scannerIds.length > 0) {
    const { data: staff } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', scannerIds as string[]);

    for (const person of staff ?? []) {
      scanners.set(person.id, person.full_name ?? person.email ?? '');
    }
  }

  const time = new Intl.DateTimeFormat('en-ZA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const header: readonly string[] = [
    'Name',
    'Email',
    'Phone',
    'Organisation',
    'Type',
    'RSVP',
    'Arrived',
    'Arrival time (SAST)',
    'Checked in by',
    'Bidder number',
  ];

  const rows2: (string | number | null)[][] = [];

  for (const row of rows ?? []) {
    const contact = row.contacts;
    const scanner = row.checked_in_by ? (scanners.get(row.checked_in_by) ?? '') : '';

    rows2.push([
      row.display_name,
      contact?.email ?? '',
      contact?.phone_e164 ?? '',
      contact?.organisation ?? '',
      row.is_walk_in ? 'Walk-in' : row.is_plus_one ? 'Plus-one' : 'Invited',
      row.invitations?.status ?? '',
      row.checked_in_at ? 'Yes' : 'No',
      row.checked_in_at ? time.format(new Date(row.checked_in_at)).replace(', ', ' ') : '',
      scanner,
      row.bidder_number ?? '',
    ]);
  }

  const slug = csvSlug(event.title, 'event');
  const csv = csvFile(header, rows2);

  await createAdminClient().rpc('log_audit', {
    p_actor_id: profile.id,
    p_action: 'attendance.exported',
    p_entity: 'events',
    p_entity_id: eventId,
    p_metadata: { rows: (rows ?? []).length },
  });

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}-attendance.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
