'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { newTokenId } from '@/lib/auth/pass';
import { signJoinToken } from '@/lib/auth/join';

export type JoinControlState = { error?: string; notice?: string };

const schema = z.object({
  eventId: z.uuid(),
  intent: z.enum(['enable', 'disable', 'regenerate']),
});

const NOTICE: Record<z.infer<typeof schema>['intent'], string> = {
  enable: 'Self-registration is on. Print the sheet and put it on the tables.',
  disable: 'Self-registration is off. Every printed code has stopped working.',
  regenerate: 'A new code has been issued. Print the new sheet before the event.',
};

/**
 * Turn self-registration on or off, or issue a fresh code — docs/07 §2.5.
 *
 * The event is read and written through the session client, so RLS confines
 * the organiser to their own department; the audit row goes through the admin
 * client because `log_audit` is granted to service_role alone.
 */
export async function setSelfRegistration(
  _prev: JoinControlState,
  formData: FormData,
): Promise<JoinControlState> {
  const profile = await requireStaff(['organiser']);

  const parsed = schema.safeParse({
    eventId: formData.get('eventId'),
    intent: formData.get('intent'),
  });
  if (!parsed.success) return { error: 'That request was not understood.' };

  const { eventId, intent } = parsed.data;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .maybeSingle();
  if (!event) return { error: 'That event is not in your department.' };

  const nonce = intent === 'disable' ? null : newTokenId();
  const { data, error } = await supabase
    .from('events')
    .update({
      join_nonce: nonce,
      join_token: nonce ? signJoinToken(eventId, nonce) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .select('id');

  if (error) return { error: `The code could not be changed: ${error.message}` };
  if (!data || data.length === 0) return { error: 'That event is not in your department.' };

  await createAdminClient().rpc('log_audit', {
    p_actor_id: profile.id,
    p_action: `event.self_registration.${intent}`,
    p_entity: 'event',
    p_entity_id: eventId,
    p_metadata: {},
  });

  revalidatePath(`/events/${eventId}/join`);
  revalidatePath(`/events/${eventId}`);
  return { notice: NOTICE[intent] };
}
