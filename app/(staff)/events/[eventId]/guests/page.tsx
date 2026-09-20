import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Search, Send } from 'lucide-react';
import { PageHeader, SectionHeading, StaffShell, StatusPill } from '@/components/staff/StaffShell';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { formatTime } from '@/lib/dates';
import { AddInviteesForm, RemoveInviteeButton } from './GuestForms';

export const metadata = { title: 'Guest list' };

const PICKER_LIMIT = 100;

/** Same reasoning as `/contacts`: a comma would be read as `or()` syntax. */
function sanitiseQuery(raw: string): string {
  return raw
    .replace(/[,()"'*\\%]/g, ' ')
    .trim()
    .slice(0, 80);
}

export default async function GuestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const { eventId } = await params;
  const { q: rawQ, tag: rawTag } = await searchParams;
  const profile = await requireStaff(['organiser']);
  const supabase = await createClient();

  const q = sanitiseQuery(rawQ ?? '');
  const tag = (rawTag ?? '').trim().toLowerCase().slice(0, 40);

  const { data: event } = await supabase
    .from('events')
    .select('id, title, status, capacity')
    .eq('id', eventId)
    .maybeSingle();

  if (!event) notFound();

  // The guest list, with the contact behind each invitation and the channels
  // each one has been sent through.
  const { data: invitations } = await supabase
    .from('invitations')
    .select(
      'id, status, sent_via, first_sent_at, opened_at, responded_at, contact_id, contacts(first_name, last_name, email, phone_e164, organisation)',
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  const invited = invitations ?? [];
  const invitedContactIds = invited.map((row) => row.contact_id);

  // The picker offers contacts who are not already on this list.
  let pickerQuery = supabase
    .from('contacts')
    .select('id, first_name, last_name, email, phone_e164, organisation, tags', {
      count: 'exact',
    })
    .order('last_name', { ascending: true })
    .limit(PICKER_LIMIT);

  if (invitedContactIds.length > 0) {
    // PostgREST wants a literal list here, and the guest list of a POC event is
    // in the tens; at production scale this becomes a `not exists` view.
    pickerQuery = pickerQuery.not('id', 'in', `(${invitedContactIds.join(',')})`);
  }
  if (q) {
    pickerQuery = pickerQuery.or(
      [
        `first_name.ilike.%${q}%`,
        `last_name.ilike.%${q}%`,
        `email.ilike.%${q}%`,
        `organisation.ilike.%${q}%`,
      ].join(','),
    );
  }
  if (tag) pickerQuery = pickerQuery.contains('tags', [tag]);

  const { data: pickable, count: pickableCount } = await pickerQuery;

  const { data: tagRows } = await supabase.from('contacts').select('tags').limit(2000);
  const tagCounts = new Map<string, number>();
  for (const row of tagRows ?? []) {
    for (const t of row.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const tags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const counts = invited.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  const filterHref = (next: { q?: string; tag?: string }) => {
    const sp = new URLSearchParams();
    const merged = { q, tag, ...next };
    if (merged.q) sp.set('q', merged.q);
    if (merged.tag) sp.set('tag', merged.tag);
    const query = sp.toString();
    return query ? `/events/${eventId}/guests?${query}` : `/events/${eventId}/guests`;
  };

  return (
    <StaffShell profile={profile}>
      <Link
        href={`/events/${eventId}`}
        className="text-cut-700 hover:text-cut-900 mb-6 inline-flex items-center gap-2 text-sm font-semibold"
      >
        <ArrowLeft className="size-4" aria-hidden /> {event.title}
      </Link>

      <PageHeader
        title="Guest list"
        breadcrumb="Invitations"
        description={
          invited.length === 0
            ? 'Nobody is on the list yet. Choose contacts on the right and add them.'
            : `${invited.length} on the list: ${counts.accepted ?? 0} accepted, ${counts.declined ?? 0} declined, ${counts.pending ?? 0} yet to reply.`
        }
        action={
          invited.length > 0 ? (
            <Button asChild size="lg" className="h-11 px-5">
              <Link href={`/events/${eventId}/invitations`}>
                <Send className="size-4" aria-hidden /> Send invitations
              </Link>
            </Button>
          ) : null
        }
      />

      {event.capacity && (counts.accepted ?? 0) >= event.capacity ? (
        <p className="border-hairline bg-gold-500/10 text-gold-600 mb-8 rounded-lg border px-4 py-3 text-sm">
          The event is at capacity ({event.capacity}). Further acceptances go on the waiting list.
        </p>
      ) : null}

      <div className="grid gap-12 lg:grid-cols-[1.25fr_1fr]">
        <section>
          <SectionHeading eyebrow="On the list" title="Invited" />

          {invited.length === 0 ? (
            <div className="border-hairline-strong rounded-xl border border-dashed p-10 text-center">
              <p className="text-ink-900 font-semibold">No guests yet</p>
              <p className="text-ink-500 mx-auto mt-1 max-w-sm text-sm">
                Adding a contact creates their invitation and their personal RSVP link. Nothing is
                sent until you send it.
              </p>
            </div>
          ) : (
            <div className="card table-card overflow-hidden">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Guest</th>
                    <th scope="col">Reply</th>
                    <th scope="col">Sent</th>
                    <th scope="col">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invited.map((row) => {
                    const contact = row.contacts;
                    const name = contact
                      ? `${contact.first_name} ${contact.last_name}`
                      : 'Unknown contact';
                    return (
                      <tr key={row.id}>
                        <td>
                          <span className="text-ink-900 font-semibold">{name}</span>
                          <span className="text-ink-500 block text-xs">
                            {contact?.email ?? contact?.phone_e164 ?? '—'}
                          </span>
                        </td>
                        <td>
                          <StatusPill status={row.status} />
                          {row.responded_at ? (
                            <span className="text-ink-500 mt-1 block text-xs">
                              {formatTime(row.responded_at)}
                            </span>
                          ) : null}
                        </td>
                        <td className="text-ink-700 text-xs">
                          {row.sent_via.length === 0 ? (
                            <span className="text-ink-300">Not sent</span>
                          ) : (
                            <>
                              {row.sent_via.join(' · ')}
                              {row.opened_at ? (
                                <span className="block text-green-600">Opened</span>
                              ) : null}
                            </>
                          )}
                        </td>
                        <td className="text-right">
                          {row.status === 'pending' ? (
                            <RemoveInviteeButton
                              eventId={eventId}
                              invitationId={row.id}
                              name={name}
                            />
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <SectionHeading eyebrow="From your contacts" title="Add guests" />

          <form action={`/events/${eventId}/guests`} className="relative mb-3">
            {tag ? <input type="hidden" name="tag" value={tag} /> : null}
            <Search
              className="text-ink-500 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Name, email or organisation"
              aria-label="Search contacts to invite"
              className="border-hairline-strong focus:border-cut-700 focus:ring-cut-700/20 h-11 w-full rounded-md border bg-white pr-3 pl-9 text-sm focus:ring-4 focus:outline-none"
            />
          </form>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Link
              href={filterHref({ tag: '' })}
              className={
                tag
                  ? 'border-hairline-strong text-ink-700 hover:border-cut-700 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors'
                  : 'bg-cut-900 rounded-full px-3 py-1.5 text-xs font-semibold text-white'
              }
            >
              All
            </Link>
            {tags.map(([name, n]) => (
              <Link
                key={name}
                href={filterHref({ tag: name === tag ? '' : name })}
                className={
                  name === tag
                    ? 'bg-cut-900 rounded-full px-3 py-1.5 text-xs font-semibold text-white'
                    : 'border-hairline-strong text-ink-700 hover:border-cut-700 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors'
                }
              >
                {name}
                <span className={name === tag ? 'ml-1.5 text-white/60' : 'text-ink-500 ml-1.5'}>
                  {n}
                </span>
              </Link>
            ))}
          </div>

          {(pickable ?? []).length === 0 ? (
            <div className="border-hairline-strong rounded-xl border border-dashed p-10 text-center">
              <p className="text-ink-900 font-semibold">
                {q || tag ? 'Nothing matches that' : 'Everyone is already invited'}
              </p>
              <p className="text-ink-500 mx-auto mt-1 max-w-sm text-sm">
                {q || tag ? (
                  <>
                    Try a shorter search, or{' '}
                    <Link href={`/events/${eventId}/guests`} className="text-cut-700 underline">
                      clear the filter
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    Every contact in your department is on this guest list. Import more on the{' '}
                    <Link href="/contacts" className="text-cut-700 underline">
                      contacts page
                    </Link>
                    .
                  </>
                )}
              </p>
            </div>
          ) : (
            <AddInviteesForm
              eventId={eventId}
              contacts={pickable ?? []}
              totalAvailable={pickableCount ?? (pickable ?? []).length}
            />
          )}
        </section>
      </div>
    </StaffShell>
  );
}
