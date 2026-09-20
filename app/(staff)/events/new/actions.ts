'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';

export type NewEventState = { error?: string };

const schema = z.object({
  title: z.string().trim().min(3, 'Give the event a title').max(160),
  startsAt: z.string().min(1, 'When does it start?'),
  venueName: z.string().trim().max(160).optional(),
  capacity: z.coerce.number().int().positive().max(100000).optional(),
  allowPlusOnes: z.coerce.boolean().default(false),
  auctionEnabled: z.coerce.boolean().default(false),
});

/** `CUT Fundraising Gala Dinner` -> `cut-fundraising-gala-dinner`. */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function createEvent(
  _prev: NewEventState,
  formData: FormData,
): Promise<NewEventState> {
  const profile = await requireStaff(['organiser']);
  if (!profile.departmentId) {
    return { error: 'Your profile has no department, so an event has nowhere to live.' };
  }

  const parsed = schema.safeParse({
    title: formData.get('title'),
    startsAt: formData.get('startsAt'),
    venueName: formData.get('venueName') || undefined,
    capacity: formData.get('capacity') || undefined,
    allowPlusOnes: formData.get('allowPlusOnes') === 'on',
    auctionEnabled: formData.get('auctionEnabled') === 'on',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }

  const input = parsed.data;
  const supabase = await createClient();

  // The datetime-local input has no zone; the organiser means SAST.
  const startsAt = new Date(`${input.startsAt}:00+02:00`).toISOString();

  const { data, error } = await supabase
    .from('events')
    .insert({
      department_id: profile.departmentId,
      title: input.title,
      slug: `${slugify(input.title)}-${Math.random().toString(36).slice(2, 7)}`,
      starts_at: startsAt,
      venue_name: input.venueName ?? null,
      capacity: input.capacity ?? null,
      allow_plus_ones: input.allowPlusOnes,
      auction_enabled: input.auctionEnabled,
      created_by: profile.id,
      status: 'draft',
    })
    .select('id')
    .single();

  if (error) return { error: `The event could not be created: ${error.message}` };

  revalidatePath('/events');
  redirect(`/events/${data.id}`);
}
