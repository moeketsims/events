import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { Scanner } from './Scanner';

export const metadata = { title: 'Scan' };

/**
 * The door — TASKS T2.6, DESIGN-SYSTEM §5.3.
 *
 * A thin server shell: it proves the session and the department, then hands a
 * client component the event it is allowed to scan. No `StaffShell` here — the
 * camera fills the viewport and a sidebar would be a thumb-width of wasted
 * glass on a phone held in one hand.
 */
export default async function ScanEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const profile = await requireStaff(['door_staff', 'organiser', 'auction_operator']);
  const supabase = await createClient();

  // RLS confines this to the door staff's own department, so a wrong id and
  // another department's id are the same answer: not found.
  const { data: event } = await supabase
    .from('events')
    .select('id, title, status, auction_enabled')
    .eq('id', eventId)
    .maybeSingle();

  if (!event) notFound();

  const [{ count: expected }, { count: checkedIn }] = await Promise.all([
    supabase.from('attendees').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    supabase
      .from('attendees')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .not('checked_in_at', 'is', null),
  ]);

  return (
    <Scanner
      event={{
        id: event.id,
        title: event.title,
        auctionEnabled: event.auction_enabled,
      }}
      initialCounts={{ expected: expected ?? 0, checkedIn: checkedIn ?? 0 }}
      staffName={profile.fullName ?? profile.email ?? 'Door'}
    />
  );
}
