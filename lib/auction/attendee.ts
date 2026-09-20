import 'server-only';

import { notFound } from 'next/navigation';
import { verifyTokenOfKind } from '@/lib/auth/pass';
import { createAdminClient } from '@/lib/supabase/admin';
import { readIncrementTable } from '@/app/(staff)/events/[eventId]/auction/schema';
import type { IncrementRow } from '@/lib/money';

/**
 * What every attendee auction page needs, loaded once — TASKS T3.3.
 *
 * The signed `p.` token is the whole credential, so it is verified and then
 * matched against the row, which is what makes a reissued pass revoke the old
 * link. Read with the admin client, returning only the fields BUILD-SPEC §7.3
 * lists: no other guest, no surname but the holder's own, and no amount that
 * is not already on the public board.
 */

export type AttendeeAuction = {
  attendee: {
    id: string;
    displayName: string;
    firstName: string;
    bidderNumber: number | null;
    checkedIn: boolean;
  };
  event: { id: string; title: string; auctionEnabled: boolean };
  auction: {
    id: string;
    title: string;
    closesAt: string | null;
    softCloseSeconds: number;
    incrementTable: IncrementRow[];
  };
};

export async function loadAttendeeAuction(token: string): Promise<AttendeeAuction> {
  const attendeeId = verifyTokenOfKind(token, 'p');
  if (!attendeeId) notFound();

  const admin = createAdminClient();

  const { data: attendee } = await admin
    .from('attendees')
    .select('id, event_id, display_name, bidder_number, checked_in_at, pass_token')
    .eq('id', attendeeId)
    .maybeSingle();

  if (!attendee || attendee.pass_token !== token) notFound();

  const { data: event } = await admin
    .from('events')
    .select('id, title, auction_enabled')
    .eq('id', attendee.event_id)
    .maybeSingle();

  if (!event || !event.auction_enabled) notFound();

  const { data: auction } = await admin
    .from('auctions')
    .select('id, title, closes_at, soft_close_seconds, increment_table')
    .eq('event_id', event.id)
    .maybeSingle();

  if (!auction) notFound();

  return {
    attendee: {
      id: attendee.id,
      displayName: attendee.display_name,
      firstName: attendee.display_name.split(' ')[0] ?? attendee.display_name,
      bidderNumber: attendee.bidder_number,
      checkedIn: attendee.checked_in_at !== null,
    },
    event: { id: event.id, title: event.title, auctionEnabled: event.auction_enabled },
    auction: {
      id: auction.id,
      title: auction.title,
      closesAt: auction.closes_at,
      softCloseSeconds: auction.soft_close_seconds,
      incrementTable: readIncrementTable(auction.increment_table),
    },
  };
}
