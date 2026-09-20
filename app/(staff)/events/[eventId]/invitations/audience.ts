/**
 * Who a send goes to. A plain module, not the `'use server'` one: a file of
 * Server Actions may export only async functions, and both the composer and
 * the action need this list.
 */
export const AUDIENCES = ['not_sent', 'pending', 'everyone'] as const;

export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABEL: Record<Audience, string> = {
  not_sent: 'Guests it has not been sent to yet',
  pending: 'Everyone yet to reply',
  everyone: 'Everyone on the guest list',
};

export const AUDIENCE_NOTE: Record<Audience, string> = {
  not_sent: 'The usual first send. Nobody is invited twice.',
  pending: 'A nudge. Guests who have already answered are left alone.',
  everyone: 'Including guests who have already replied. Use for a change of venue or time.',
};
