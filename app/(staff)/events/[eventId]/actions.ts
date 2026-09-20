'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SUPABASE_URL } from '@/lib/env';
import { fromDateTimeLocal as sastToIso } from '@/lib/dates';
import { NEXT_STATUS } from './status';

export type EventActionState = { error?: string; notice?: string };

const updateSchema = z.object({
  eventId: z.uuid(),
  title: z.string().trim().min(3, 'Give the event a title').max(160),
  description: z.string().trim().max(4000).optional(),
  startsAt: z.string().min(1, 'When does it start?'),
  endsAt: z.string().optional(),
  rsvpDeadline: z.string().optional(),
  venueName: z.string().trim().max(160).optional(),
  venueAddress: z.string().trim().max(400).optional(),
  capacity: z.coerce.number().int().positive().max(100000).optional(),
  allowPlusOnes: z.boolean(),
  auctionEnabled: z.boolean(),
});

/** Edit an event. Organiser only, and only within their own department (RLS). */
export async function updateEvent(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  await requireStaff(['organiser']);

  const parsed = updateSchema.safeParse({
    eventId: formData.get('eventId'),
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    startsAt: formData.get('startsAt'),
    endsAt: formData.get('endsAt') || undefined,
    rsvpDeadline: formData.get('rsvpDeadline') || undefined,
    venueName: formData.get('venueName') || undefined,
    venueAddress: formData.get('venueAddress') || undefined,
    capacity: formData.get('capacity') || undefined,
    allowPlusOnes: formData.get('allowPlusOnes') === 'on',
    auctionEnabled: formData.get('auctionEnabled') === 'on',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }

  const input = parsed.data;

  if (input.endsAt && sastToIso(input.endsAt) <= sastToIso(input.startsAt)) {
    return { error: 'The event cannot end before it starts.' };
  }
  if (input.rsvpDeadline && sastToIso(input.rsvpDeadline) > sastToIso(input.startsAt)) {
    return { error: 'The RSVP deadline has to fall before the event begins.' };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('events')
    .update({
      title: input.title,
      description: input.description ?? null,
      starts_at: sastToIso(input.startsAt),
      ends_at: input.endsAt ? sastToIso(input.endsAt) : null,
      rsvp_deadline: input.rsvpDeadline ? sastToIso(input.rsvpDeadline) : null,
      venue_name: input.venueName ?? null,
      venue_address: input.venueAddress ?? null,
      capacity: input.capacity ?? null,
      allow_plus_ones: input.allowPlusOnes,
      auction_enabled: input.auctionEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.eventId);

  if (error) return { error: `The event could not be saved: ${error.message}` };

  revalidatePath(`/events/${input.eventId}`);
  revalidatePath('/events');
  revalidatePath('/dashboard');
  return { notice: 'Saved.' };
}

const statusSchema = z.object({
  eventId: z.uuid(),
  status: z.enum(['draft', 'published', 'live', 'closed', 'archived']),
});

export async function setEventStatus(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  await requireStaff(['organiser']);

  const parsed = statusSchema.safeParse({
    eventId: formData.get('eventId'),
    status: formData.get('status'),
  });
  if (!parsed.success) return { error: 'That is not a status we recognise.' };

  const { eventId, status } = parsed.data;
  const supabase = await createClient();

  const { data: current } = await supabase
    .from('events')
    .select('status')
    .eq('id', eventId)
    .maybeSingle();

  if (!current) return { error: 'That event is not in your department.' };

  if (!NEXT_STATUS[current.status].includes(status)) {
    return { error: `An event that is ${current.status} cannot become ${status}.` };
  }

  const { error } = await supabase
    .from('events')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', eventId);

  if (error) return { error: `The status could not be changed: ${error.message}` };

  revalidatePath(`/events/${eventId}`);
  revalidatePath('/events');
  revalidatePath('/dashboard');
  return { notice: `The event is now ${status}.` };
}

const BANNER_BUCKET = 'event-banners';
const MAX_BANNER_BYTES = 4 * 1024 * 1024;

const bannerSchema = z.object({
  eventId: z.uuid(),
  file: z
    .instanceof(File)
    .refine((f) => f.size > 0, 'Choose an image first.')
    .refine((f) => f.size <= MAX_BANNER_BYTES, 'That image is larger than 4 MB.')
    .refine(
      (f) => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type),
      'Banners must be a JPEG, PNG or WebP.',
    ),
});

/**
 * Upload an event banner to the public `event-banners` bucket.
 *
 * Storage has no insert policy (migration 0008): every write goes through the
 * service-role client here, so a compromised browser cannot put files in a
 * public bucket. The role check above it is what authorises the write.
 */
export async function uploadBanner(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  await requireStaff(['organiser']);

  const parsed = bannerSchema.safeParse({
    eventId: formData.get('eventId'),
    file: formData.get('file'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'That file could not be read.' };
  }

  const { eventId, file } = parsed.data;

  // Confirm the event is the organiser's own through the session client, which
  // is subject to RLS, before touching Storage with the admin client.
  const supabase = await createClient();
  const { data: event } = await supabase
    .from('events')
    .select('id, banner_url')
    .eq('id', eventId)
    .maybeSingle();

  if (!event) return { error: 'That event is not in your department.' };

  const admin = createAdminClient();
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  // A new name each time, so a replaced banner is never served from a CDN cache
  // still holding the old one.
  const path = `${eventId}/${Date.now()}.${extension}`;

  const { error: uploadError } = await admin.storage
    .from(BANNER_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });

  if (uploadError) return { error: `The banner could not be uploaded: ${uploadError.message}` };

  const bannerUrl = `${SUPABASE_URL}/storage/v1/object/public/${BANNER_BUCKET}/${path}`;

  const { error } = await supabase
    .from('events')
    .update({ banner_url: bannerUrl, updated_at: new Date().toISOString() })
    .eq('id', eventId);

  if (error) return { error: `The banner could not be saved: ${error.message}` };

  // Remove the file the event used to point at, so the bucket does not collect
  // every banner an organiser has ever tried.
  const previous = event.banner_url;
  if (previous?.includes(`/${BANNER_BUCKET}/`)) {
    const oldPath = previous.split(`/${BANNER_BUCKET}/`)[1];
    if (oldPath && oldPath !== path) await admin.storage.from(BANNER_BUCKET).remove([oldPath]);
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath('/events');
  revalidatePath('/dashboard');
  return { notice: 'Banner updated.' };
}
