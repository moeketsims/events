import { TIME_ZONE } from '@/lib/env';

/**
 * Every date the product shows is rendered in Africa/Johannesburg, from a
 * timestamptz stored in UTC. `toLocaleString()` without a zone would render in
 * the *server's* zone, which on Vercel is UTC — two hours out, enough to put a
 * check-in on the wrong side of midnight and to print the wrong time on a pass.
 */

const DATE_TIME = new Intl.DateTimeFormat('en-ZA', {
  timeZone: TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const TIME_ONLY = new Intl.DateTimeFormat('en-ZA', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const DATE_ONLY = new Intl.DateTimeFormat('en-ZA', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `Friday 30 October 2026, 18:00` — DESIGN-SYSTEM §6. */
export function formatEventDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  const parts = DATE_TIME.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('weekday')} ${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')}`;
}

/** `18:42` — check-in times, broadcast timestamps. */
export function formatTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? TIME_ONLY.format(date) : '—';
}

/** `30 October 2026` */
export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? DATE_ONLY.format(date) : '—';
}

/** `6:12` / `1:04:30` — lot countdowns, computed from closes_at on the client. */
export function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return '0:00';
  const total = Math.floor(msRemaining / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  return hours > 0
    ? `${hours}:${mm}:${String(seconds).padStart(2, '0')}`
    : `${mm}:${String(seconds).padStart(2, '0')}`;
}

/** Bidder numbers read as 042 on cards and in copy. */
export function formatBidderNumber(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : String(n).padStart(3, '0');
}

/**
 * A `timestamptz` back into the `YYYY-MM-DDTHH:mm` a datetime-local input
 * wants, rendered in SAST. Doing this with `toISOString().slice(0,16)` would
 * show the organiser 16:00 for an event that starts at 18:00.
 */
export function toDateTimeLocal(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '';
  const parts = new Intl.DateTimeFormat('en-ZA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  // en-ZA formats hour 24 as "24" at midnight; the input wants "00".
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

/** A `datetime-local` value carries no zone; the organiser means SAST (UTC+2, no DST). */
export function fromDateTimeLocal(local: string): string {
  return new Date(`${local}:00+02:00`).toISOString();
}
