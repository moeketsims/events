'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SUPABASE_URL } from '@/lib/env';
import { fromDateTimeLocal } from '@/lib/dates';
import { incrementTableSchema, lotSchema, SOFT_CLOSE_MAX, SOFT_CLOSE_MIN } from './schema';

export type AuctionActionState = { error?: string; notice?: string };
export type LotActionState = AuctionActionState & { lotId?: string };
export type ImagesResult = { error?: string; images?: string[] };

const OPERATORS = ['organiser', 'auction_operator'] as const;
const LOT_IMAGES_BUCKET = 'lot-images';
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_IMAGES_PER_LOT = 8;

/**
 * The auction editor — TASKS T3.2, BUILD-SPEC §7.1.
 *
 * Every write to `auctions` and `lots` goes through the session client, so the
 * `auctions_dept_write` and `lots_dept_write` policies decide who may touch
 * what. The admin client appears only where the database gives the browser no
 * path at all: Storage, which has no insert policy by design (0008), and the
 * audit log, which is written by `log_audit` alone.
 */

function paths(eventId: string) {
  return [`/events/${eventId}/auction`, `/events/${eventId}`, '/dashboard'];
}

function revalidate(eventId: string) {
  for (const path of paths(eventId)) revalidatePath(path);
}

// ---------------------------------------------------------------------------
// Auction
// ---------------------------------------------------------------------------

const enableSchema = z.object({ eventId: z.uuid() });

/** Create the `auctions` row with defaults and switch the event's auction on. */
export async function enableAuction(
  _prev: AuctionActionState,
  formData: FormData,
): Promise<AuctionActionState> {
  await requireStaff(OPERATORS);

  const parsed = enableSchema.safeParse({ eventId: formData.get('eventId') });
  if (!parsed.success) return { error: 'That event could not be found.' };
  const { eventId } = parsed.data;

  const supabase = await createClient();
  const { data: event } = await supabase
    .from('events')
    .select('id, title, auction_enabled')
    .eq('id', eventId)
    .maybeSingle();
  if (!event) return { error: 'That event is not in your department.' };

  const { data: existing } = await supabase
    .from('auctions')
    .select('id')
    .eq('event_id', eventId)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase
      .from('auctions')
      .insert({ event_id: eventId, title: `${event.title} — Silent Auction` });
    if (error) return { error: `The auction could not be created: ${error.message}` };
  }

  if (!event.auction_enabled) {
    // `events` is organiser-writable only; an auction operator enabling the
    // auction has just proved, through RLS on the insert above, that the event
    // is theirs. The flag is the event's side of the same switch.
    const { error } = await createAdminClient()
      .from('events')
      .update({ auction_enabled: true, updated_at: new Date().toISOString() })
      .eq('id', eventId);
    if (error) return { error: `The event could not be updated: ${error.message}` };
  }

  revalidate(eventId);
  revalidatePath('/events');
  return { notice: 'The silent auction is enabled.' };
}

const settingsSchema = z.object({
  eventId: z.uuid(),
  auctionId: z.uuid(),
  title: z.string().trim().min(2, 'Give the auction a title.').max(160),
  closesAt: z.string().optional(),
  softCloseSeconds: z.coerce
    .number()
    .int()
    .min(SOFT_CLOSE_MIN, `Soft close is between ${SOFT_CLOSE_MIN} and ${SOFT_CLOSE_MAX} seconds.`)
    .max(SOFT_CLOSE_MAX, `Soft close is between ${SOFT_CLOSE_MIN} and ${SOFT_CLOSE_MAX} seconds.`),
  incrementTable: z.string(),
});

export async function upsertAuction(
  _prev: AuctionActionState,
  formData: FormData,
): Promise<AuctionActionState> {
  await requireStaff(OPERATORS);

  const parsed = settingsSchema.safeParse({
    eventId: formData.get('eventId'),
    auctionId: formData.get('auctionId'),
    title: formData.get('title'),
    closesAt: formData.get('closesAt') || undefined,
    softCloseSeconds: formData.get('softCloseSeconds'),
    incrementTable: formData.get('incrementTable'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }

  let table: unknown;
  try {
    table = JSON.parse(parsed.data.incrementTable);
  } catch {
    return { error: 'The increment table could not be read.' };
  }
  const increments = incrementTableSchema.safeParse(table);
  if (!increments.success) {
    return { error: increments.error.issues[0]?.message ?? 'Check the increment table.' };
  }

  const { eventId, auctionId, title, closesAt, softCloseSeconds } = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('auctions')
    .update({
      title,
      closes_at: closesAt ? fromDateTimeLocal(closesAt) : null,
      soft_close_seconds: softCloseSeconds,
      increment_table: increments.data,
    })
    .eq('id', auctionId)
    .eq('event_id', eventId)
    .select('id');

  if (error) return { error: `The settings could not be saved: ${error.message}` };
  if (!data || data.length === 0) return { error: 'That auction is not in your department.' };

  revalidate(eventId);
  return { notice: 'Auction settings saved.' };
}

const keySchema = z.object({ eventId: z.uuid(), auctionId: z.uuid() });

/**
 * A new display key. The old projection link stops working the moment this
 * returns, so the page warns before the button is pressed. Logged: the key is
 * the projection's only credential, and who rotated it matters afterwards.
 */
export async function regenerateDisplayKey(
  _prev: AuctionActionState,
  formData: FormData,
): Promise<AuctionActionState> {
  const profile = await requireStaff(OPERATORS);

  const parsed = keySchema.safeParse({
    eventId: formData.get('eventId'),
    auctionId: formData.get('auctionId'),
  });
  if (!parsed.success) return { error: 'That auction could not be found.' };
  const { eventId, auctionId } = parsed.data;

  const key = randomBytes(16).toString('hex');
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('auctions')
    .update({ display_key: key })
    .eq('id', auctionId)
    .eq('event_id', eventId)
    .select('id');

  if (error) return { error: `The key could not be changed: ${error.message}` };
  if (!data || data.length === 0) return { error: 'That auction is not in your department.' };

  await createAdminClient().rpc('log_audit', {
    p_actor_id: profile.id,
    p_action: 'auction.display_key_rotated',
    p_entity: 'auctions',
    p_entity_id: auctionId,
    p_metadata: { event_id: eventId },
  });

  revalidate(eventId);
  return {
    notice: 'New display link issued. Open it on the projector; the old one no longer works.',
  };
}

// ---------------------------------------------------------------------------
// Lots
// ---------------------------------------------------------------------------

export async function upsertLot(
  _prev: LotActionState,
  formData: FormData,
): Promise<LotActionState> {
  await requireStaff(OPERATORS);

  const eventId = z.uuid().safeParse(formData.get('eventId'));
  if (!eventId.success) return { error: 'That event could not be found.' };

  const parsed = lotSchema.safeParse({
    auctionId: formData.get('auctionId'),
    lotId: formData.get('lotId') || undefined,
    lotNumber: formData.get('lotNumber'),
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    donorName: formData.get('donorName') || undefined,
    startingBid: formData.get('startingBid'),
    reserve: formData.get('reserve') || undefined,
    buyNowPrice: formData.get('buyNowPrice') || undefined,
    status: formData.get('status'),
    closesAt: formData.get('closesAt') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }

  const lot = parsed.data;
  const supabase = await createClient();

  const row = {
    lot_number: lot.lotNumber,
    title: lot.title,
    description: lot.description ?? null,
    donor_name: lot.donorName ?? null,
    starting_bid: lot.startingBid,
    reserve: lot.reserve ?? null,
    buy_now_price: lot.buyNowPrice ?? null,
    status: lot.status,
    closes_at: lot.closesAt ? fromDateTimeLocal(lot.closesAt) : null,
  };

  if (lot.lotId) {
    // A lot that has already been settled keeps its outcome: the editor never
    // offers `closed` or `unsold`, and it must not undo them either.
    const { data: current } = await supabase
      .from('lots')
      .select('status')
      .eq('id', lot.lotId)
      .maybeSingle();
    if (!current) return { error: 'That lot is not in your department.' };
    const status =
      current.status === 'closed' || current.status === 'unsold' ? current.status : lot.status;

    const { error } = await supabase
      .from('lots')
      .update({ ...row, status })
      .eq('id', lot.lotId)
      .eq('auction_id', lot.auctionId);
    if (error) return { error: describeLotError(error.message, lot.lotNumber) };

    revalidate(eventId.data);
    return { notice: 'Lot saved.', lotId: lot.lotId };
  }

  const { data: last } = await supabase
    .from('lots')
    .select('sort_order')
    .eq('auction_id', lot.auctionId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created, error } = await supabase
    .from('lots')
    .insert({ ...row, auction_id: lot.auctionId, sort_order: (last?.sort_order ?? 0) + 1 })
    .select('id')
    .single();
  if (error || !created) {
    return { error: describeLotError(error?.message ?? 'unknown', lot.lotNumber) };
  }

  revalidate(eventId.data);
  return { notice: 'Lot created. Add its photographs below.', lotId: created.id };
}

function describeLotError(message: string, lotNumber: number): string {
  if (message.includes('lots_auction_id_lot_number_key')) {
    return `Lot number ${lotNumber} is already taken.`;
  }
  if (message.includes('row-level security')) return 'That auction is not in your department.';
  return `The lot could not be saved: ${message}`;
}

const lotRefSchema = z.object({ eventId: z.uuid(), lotId: z.uuid() });

/** Delete a lot that has never been bid on. Anything else is withdrawn, not deleted. */
export async function deleteLot(
  _prev: AuctionActionState,
  formData: FormData,
): Promise<AuctionActionState> {
  await requireStaff(OPERATORS);

  const parsed = lotRefSchema.safeParse({
    eventId: formData.get('eventId'),
    lotId: formData.get('lotId'),
  });
  if (!parsed.success) return { error: 'That lot could not be found.' };
  const { eventId, lotId } = parsed.data;

  const supabase = await createClient();

  const { count } = await supabase
    .from('bids')
    .select('id', { count: 'exact', head: true })
    .eq('lot_id', lotId);
  if ((count ?? 0) > 0) {
    return {
      error: 'This lot has bids on it. Withdraw it instead, so the ledger keeps its history.',
    };
  }

  const { data: lot } = await supabase
    .from('lots')
    .select('id, auction_id, images')
    .eq('id', lotId)
    .maybeSingle();
  if (!lot) return { error: 'That lot is not in your department.' };

  const { error } = await supabase.from('lots').delete().eq('id', lotId);
  if (error) return { error: `The lot could not be deleted: ${error.message}` };

  const objects = lot.images.map(storagePath).filter((p): p is string => p !== null);
  if (objects.length > 0) await createAdminClient().storage.from(LOT_IMAGES_BUCKET).remove(objects);

  revalidate(eventId);
  return { notice: 'Lot deleted.' };
}

const reorderSchema = z.object({
  eventId: z.uuid(),
  auctionId: z.uuid(),
  orderedIds: z.array(z.uuid()).min(1).max(500),
});

/** Write `sort_order` for every lot in the order given. Called after a drag. */
export async function reorderLots(input: {
  eventId: string;
  auctionId: string;
  orderedIds: string[];
}): Promise<AuctionActionState> {
  await requireStaff(OPERATORS);

  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { error: 'That order could not be read.' };
  const { eventId, auctionId, orderedIds } = parsed.data;

  const supabase = await createClient();
  for (const [index, id] of orderedIds.entries()) {
    const { error } = await supabase
      .from('lots')
      .update({ sort_order: index + 1 })
      .eq('id', id)
      .eq('auction_id', auctionId);
    if (error) return { error: `The order could not be saved: ${error.message}` };
  }

  revalidate(eventId);
  return { notice: 'Order saved.' };
}

// ---------------------------------------------------------------------------
// Lot images
// ---------------------------------------------------------------------------

const imageSchema = z.object({
  eventId: z.uuid(),
  auctionId: z.uuid(),
  lotId: z.uuid(),
  file: z
    .instanceof(File)
    .refine((f) => f.size > 0, 'Choose an image first.')
    .refine((f) => f.size <= MAX_IMAGE_BYTES, 'That image is larger than 4 MB.')
    .refine(
      (f) => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type),
      'Photographs must be a JPEG, PNG or WebP.',
    ),
});

/**
 * Add a photograph to a lot. The browser has already resized it (`lib/images`);
 * the bytes go to Storage through the admin client because the bucket has no
 * insert policy, and the URL is appended to `lots.images` through the session
 * client, which is where RLS says whether this lot is the caller's at all.
 */
export async function uploadLotImage(formData: FormData): Promise<ImagesResult> {
  await requireStaff(OPERATORS);

  const parsed = imageSchema.safeParse({
    eventId: formData.get('eventId'),
    auctionId: formData.get('auctionId'),
    lotId: formData.get('lotId'),
    file: formData.get('file'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'That file could not be read.' };
  }
  const { eventId, auctionId, lotId, file } = parsed.data;

  const supabase = await createClient();
  const { data: lot } = await supabase
    .from('lots')
    .select('id, images')
    .eq('id', lotId)
    .eq('auction_id', auctionId)
    .maybeSingle();
  if (!lot) return { error: 'That lot is not in your department.' };
  if (lot.images.length >= MAX_IMAGES_PER_LOT) {
    return { error: `A lot carries at most ${MAX_IMAGES_PER_LOT} photographs.` };
  }

  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${auctionId}/${lotId}/${Date.now()}.${extension}`;

  const { error: uploadError } = await createAdminClient()
    .storage.from(LOT_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { error: `The photograph could not be uploaded: ${uploadError.message}` };

  const images = [...lot.images, publicUrl(path)];
  const { error } = await supabase.from('lots').update({ images }).eq('id', lotId);
  if (error) return { error: `The photograph could not be saved: ${error.message}` };

  revalidate(eventId);
  return { images };
}

const imageRefSchema = z.object({
  eventId: z.uuid(),
  lotId: z.uuid(),
  url: z.string().url().max(1000),
});

export async function deleteLotImage(input: {
  eventId: string;
  lotId: string;
  url: string;
}): Promise<ImagesResult> {
  await requireStaff(OPERATORS);

  const parsed = imageRefSchema.safeParse(input);
  if (!parsed.success) return { error: 'That photograph could not be found.' };
  const { eventId, lotId, url } = parsed.data;

  const supabase = await createClient();
  const { data: lot } = await supabase
    .from('lots')
    .select('id, images')
    .eq('id', lotId)
    .maybeSingle();
  if (!lot) return { error: 'That lot is not in your department.' };
  if (!lot.images.includes(url)) return { error: 'That photograph is not on this lot.' };

  const images = lot.images.filter((image) => image !== url);
  const { error } = await supabase.from('lots').update({ images }).eq('id', lotId);
  if (error) return { error: `The photograph could not be removed: ${error.message}` };

  const path = storagePath(url);
  if (path) await createAdminClient().storage.from(LOT_IMAGES_BUCKET).remove([path]);

  revalidate(eventId);
  return { images };
}

/** Move one photograph to the front: the first image is the lot's card image everywhere. */
export async function makeFirstImage(input: {
  eventId: string;
  lotId: string;
  url: string;
}): Promise<ImagesResult> {
  await requireStaff(OPERATORS);

  const parsed = imageRefSchema.safeParse(input);
  if (!parsed.success) return { error: 'That photograph could not be found.' };
  const { eventId, lotId, url } = parsed.data;

  const supabase = await createClient();
  const { data: lot } = await supabase
    .from('lots')
    .select('id, images')
    .eq('id', lotId)
    .maybeSingle();
  if (!lot) return { error: 'That lot is not in your department.' };
  if (!lot.images.includes(url)) return { error: 'That photograph is not on this lot.' };

  const images = [url, ...lot.images.filter((image) => image !== url)];
  const { error } = await supabase.from('lots').update({ images }).eq('id', lotId);
  if (error) return { error: `The order could not be saved: ${error.message}` };

  revalidate(eventId);
  return { images };
}

function publicUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${LOT_IMAGES_BUCKET}/${path}`;
}

/** The object path inside the bucket, or null for a URL that is not ours. */
function storagePath(url: string): string | null {
  const marker = `/${LOT_IMAGES_BUCKET}/`;
  const index = url.indexOf(marker);
  return index === -1 ? null : url.slice(index + marker.length);
}
