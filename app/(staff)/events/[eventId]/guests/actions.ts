'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { newTokenId, signToken } from '@/lib/auth/pass';

export type GuestActionState = { error?: string; notice?: string };

const addSchema = z.object({
  eventId: z.uuid(),
  contactIds: z.array(z.uuid()).min(1, 'Choose at least one contact.').max(500),
});

/**
 * Put contacts on the guest list — TASKS T2.3.
 *
 * Each invitation carries a signed `r.` token that is the guest's whole
 * credential for the RSVP page, so the id is minted here and the row is
 * inserted with its token already set. Inserting first and signing afterwards
 * would leave a window in which a row exists with no usable token, and a send
 * that raced it would post a dead link.
 */
export async function addInvitees(
  _prev: GuestActionState,
  formData: FormData,
): Promise<GuestActionState> {
  await requireStaff(['organiser']);

  const parsed = addSchema.safeParse({
    eventId: formData.get('eventId'),
    contactIds: formData.getAll('contactIds').map(String),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Choose at least one contact.' };
  }

  const { eventId, contactIds } = parsed.data;
  const supabase = await createClient();

  // RLS would refuse the write anyway; this turns that into a sentence.
  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .maybeSingle();
  if (!event) return { error: 'That event is not in your department.' };

  // Contacts already invited are skipped rather than refused: an organiser
  // adding a segment twice means "make sure these people are on the list".
  const { data: existing } = await supabase
    .from('invitations')
    .select('contact_id')
    .eq('event_id', eventId)
    .in('contact_id', contactIds);

  const already = new Set((existing ?? []).map((row) => row.contact_id));
  const fresh = contactIds.filter((id) => !already.has(id));

  if (fresh.length === 0) {
    return { notice: 'Everyone you chose is already on the guest list.' };
  }

  const rows = fresh.map((contactId) => {
    const id = newTokenId();
    return {
      id,
      event_id: eventId,
      contact_id: contactId,
      token: signToken('r', id),
      status: 'pending' as const,
    };
  });

  const { error } = await supabase.from('invitations').insert(rows);
  if (error) return { error: `They could not be added: ${error.message}` };

  revalidatePath(`/events/${eventId}/guests`);
  revalidatePath(`/events/${eventId}`);

  const skipped = contactIds.length - fresh.length;
  return {
    notice:
      `${fresh.length} added to the guest list.` +
      (skipped > 0 ? ` ${skipped} ${skipped === 1 ? 'was' : 'were'} already on it.` : ''),
  };
}

const removeSchema = z.object({
  eventId: z.uuid(),
  invitationId: z.uuid(),
});

/**
 * Take someone off the guest list.
 *
 * Only while the invitation is still `pending`. Once a guest has answered there
 * is an RSVP, possibly attendees with issued passes, and quietly deleting the
 * row would leave a pass that the door cannot explain. Withdrawing an answered
 * invitation is a Stage B conversation about cancellation, not a delete.
 */
export async function removeInvitee(
  _prev: GuestActionState,
  formData: FormData,
): Promise<GuestActionState> {
  await requireStaff(['organiser']);

  const parsed = removeSchema.safeParse({
    eventId: formData.get('eventId'),
    invitationId: formData.get('invitationId'),
  });
  if (!parsed.success) return { error: 'That invitation could not be found.' };

  const { eventId, invitationId } = parsed.data;
  const supabase = await createClient();

  const { data: invitation } = await supabase
    .from('invitations')
    .select('id, status')
    .eq('id', invitationId)
    .eq('event_id', eventId)
    .maybeSingle();

  if (!invitation) return { error: 'That invitation is not on this event.' };
  if (invitation.status !== 'pending') {
    return { error: 'They have already replied, so they cannot simply be removed.' };
  }

  const { error } = await supabase.from('invitations').delete().eq('id', invitationId);
  if (error) return { error: `They could not be removed: ${error.message}` };

  revalidatePath(`/events/${eventId}/guests`);
  revalidatePath(`/events/${eventId}`);
  return { notice: 'Removed from the guest list.' };
}
