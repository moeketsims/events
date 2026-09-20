import type { Database } from '@/lib/db/types';

export type EventStatus = Database['public']['Enums']['event_status'];

/**
 * The status lifecycle, as a map of what may follow what.
 *
 * `live` is also set by the database the moment the first guest is checked in,
 * so the organiser rarely presses it; it is here for a rehearsal and for an
 * event whose doors open before anyone scans. Going back from `published` to
 * `draft` is allowed because an event published by mistake has to be
 * retractable; going back from `live` is not, because arrivals have happened.
 *
 * Plain module, not the `'use server'` one: a file of Server Actions may export
 * only async functions, and both the page and the action need this table.
 */
export const NEXT_STATUS: Record<EventStatus, EventStatus[]> = {
  draft: ['published'],
  published: ['live', 'draft'],
  live: ['closed'],
  closed: ['archived'],
  archived: [],
};

/** What the button that moves an event *into* each status should say. */
export const STATUS_ACTION_LABEL: Record<EventStatus, string> = {
  draft: 'Return to draft',
  published: 'Publish',
  live: 'Open the doors',
  closed: 'Close the event',
  archived: 'Archive',
};

/**
 * One line naming what each status means. It sits under the transition buttons,
 * describing what the first of them would do, and it also stands alone on the
 * overview for someone who cannot change the status — so each line has to read
 * correctly both as a promise and as a description.
 */
export const STATUS_MEANING: Record<EventStatus, string> = {
  draft: 'Draft: only your department can see it, and invitations cannot be sent.',
  published: 'Published: invitations can go out and guests can RSVP.',
  live: 'Doors open: this also happens by itself on the first check-in.',
  closed: 'Closed: check-in and bidding end. The register and results stay available.',
  archived: 'Archived: filed away, and nothing further changes.',
};
