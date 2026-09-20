/**
 * A calendar file for the event — "Add to calendar" on the RSVP success screen
 * and on the pass page.
 *
 * Hand-rolled rather than a dependency: an event with one VEVENT is a dozen
 * lines, and RFC 5545's only real traps are CRLF endings, escaping and the
 * 75-octet fold, all of which are handled below.
 */

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** `2026-10-30T16:00:00.000Z` → `20261030T160000Z`. */
function toIcsUtc(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/**
 * Fold to 75 octets, as RFC 5545 requires. Outlook in particular will drop a
 * property it cannot parse, and a long venue address passes 75 easily.
 */
function fold(line: string): string {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line;

  const out: string[] = [];
  let current = '';
  for (const char of line) {
    // A continuation line begins with one space, so the budget is 74.
    const limit = out.length === 0 ? 75 : 74;
    if (Buffer.byteLength(current + char, 'utf8') > limit) {
      out.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  out.push(current);
  return out.map((part, i) => (i === 0 ? part : ` ${part}`)).join('\r\n');
}

export function buildIcs(input: {
  uid: string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  description?: string | null;
  url?: string | null;
}): string {
  // An event with no stated end is three hours, the length of a dinner. A
  // calendar entry with no end at all shows as an all-day block in Outlook.
  const end = input.endsAt
    ? new Date(input.endsAt)
    : new Date(new Date(input.startsAt).getTime() + 3 * 60 * 60 * 1000);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Central University of Technology//CUT Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${input.uid}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(input.startsAt)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeText(input.title)}`,
    input.location ? `LOCATION:${escapeText(input.location)}` : '',
    input.description ? `DESCRIPTION:${escapeText(input.description)}` : '',
    input.url ? `URL:${input.url}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  // CRLF throughout, as the RFC requires; a bare LF breaks older Outlook.
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** A filename a person will recognise in their downloads folder. */
export function icsFilename(title: string): string {
  const slug =
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'cut-event';
  return `${slug}.ics`;
}
