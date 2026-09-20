import { REALTIME_MODE } from '@/lib/env';

/**
 * Realtime topics and payloads — BUILD-SPEC §4.6, mirroring the comment block
 * at the top of `0006_realtime.sql`.
 *
 * The platform uses database broadcast (`realtime.send`) rather than
 * `postgres_changes`: payloads are hand-built and anonymised, so a public
 * channel never carries a name, an email or a contact id. Bidder numbers only.
 * A payload is a signal that something changed; a client that needs more than
 * the payload holds refetches through an authenticated route.
 *
 * `NEXT_PUBLIC_REALTIME_MODE=poll` turns the whole thing off, so a project
 * where `realtime.send` or public channels are unavailable falls back to
 * polling rather than showing a board that never moves. The demo cannot be
 * blocked by a setting in a dashboard.
 */

export const eventTopic = (eventId: string) => `event:${eventId}`;
export const auctionTopic = (auctionId: string) => `auction:${auctionId}`;
export const attendeeTopic = (attendeeId: string) => `attendee:${attendeeId}`;

export type CheckinPayload = { event_id: string; checked_in_count: number };
export type BroadcastPayload = { broadcast_id: string };

export type BidPlacedPayload = {
  lot_id: string;
  lot_number: number;
  amount: number;
  bidder_number: number | null;
  closes_at: string | null;
  next_min: number;
};

export type LotStatusPayload = {
  lot_id: string;
  status: string;
  closes_at: string | null;
};

export type BidVoidedPayload = {
  lot_id: string;
  lot_number: number;
  high_bid: number | null;
  high_bidder_number: number | null;
  next_min: number;
};

export type DisplayModePayload = { mode: string; lot_id: string | null };
export type OutbidPayload = { lot_id: string; lot_number: number; amount: number };

/** True when clients should subscribe; false when they should poll instead. */
export const realtimeEnabled = REALTIME_MODE === 'broadcast';

/** How often the polling fallback asks, when realtime is off. */
export const POLL_INTERVAL_MS = 2000;
