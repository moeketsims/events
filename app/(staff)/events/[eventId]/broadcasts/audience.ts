/**
 * Who a broadcast goes to. A plain module, not the `'use server'` one: a file
 * of Server Actions may export only async functions, and both the composer and
 * the action need this list.
 *
 * Membership is decided once, at send time, by which attendees receive an
 * `in_app` delivery row (BUILD-SPEC §7.3). A guest who arrives after a
 * "checked in" broadcast was sent does not see it: it was about the room as it
 * was, and "dinner is served" is not news to someone still in traffic.
 */
export const AUDIENCES = ['checked_in', 'all_accepted', 'not_arrived'] as const;

export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABEL: Record<Audience, string> = {
  checked_in: 'Everyone in the room',
  all_accepted: 'Everyone who accepted',
  not_arrived: 'Guests not yet arrived',
};

export const AUDIENCE_NOTE: Record<Audience, string> = {
  checked_in: 'Guests who have been checked in at the door. The usual choice during the event.',
  all_accepted: 'Everyone holding a pass, whether or not they have arrived.',
  not_arrived: 'Only guests who have not been checked in yet. For directions or a delayed start.',
};

/** Audience labels for the log, keyed by the `segment` stored on the row. */
export function audienceLabel(segment: unknown): string {
  return typeof segment === 'string' && segment in AUDIENCE_LABEL
    ? AUDIENCE_LABEL[segment as Audience]
    : 'Guests';
}
