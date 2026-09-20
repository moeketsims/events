'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type ManualCheckInState = { error?: string; notice?: string };

const schema = z.object({
  eventId: z.uuid(),
  attendeeId: z.uuid(),
});

/**
 * Check a guest in from the register rather than from the door — TASKS T2.7.
 *
 * The same `check_in_attendee` the scanner calls, so a guest checked in from a
 * laptop gets a bidder number the same way and the same realtime payload goes
 * out. There is no second path into `attendees.checked_in_at`, which is the
 * point: one function, one lock, one sequence of numbers.
 */
export async function manualCheckIn(
  _prev: ManualCheckInState,
  formData: FormData,
): Promise<ManualCheckInState> {
  const profile = await requireStaff(['organiser', 'auction_operator']);

  const parsed = schema.safeParse({
    eventId: formData.get('eventId'),
    attendeeId: formData.get('attendeeId'),
  });
  if (!parsed.success) return { error: 'That guest could not be found.' };

  const { eventId, attendeeId } = parsed.data;

  // RLS decides whether this organiser may touch this event at all.
  const supabase = await createClient();
  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .maybeSingle();

  if (!event) return { error: 'That event is not in your department.' };

  const { data, error } = await createAdminClient().rpc('check_in_attendee', {
    p_attendee_id: attendeeId,
    p_staff_id: profile.id,
    p_event_id: eventId,
  });

  if (error) return { error: `They could not be checked in: ${error.message}` };

  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath(`/events/${eventId}/attendance`);
  revalidatePath(`/events/${eventId}`);

  if (row?.result === 'already_checked_in') {
    return { notice: `${row.display_name} was already checked in.` };
  }
  if (row?.result !== 'checked_in') {
    return { error: 'That guest is not on this event.' };
  }

  return {
    notice: row.bidder_number
      ? `${row.display_name} is in, as bidder ${String(row.bidder_number).padStart(3, '0')}.`
      : `${row.display_name} is in.`,
  };
}
