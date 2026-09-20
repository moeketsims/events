import { describe, expect, it } from 'vitest';
import { buildIcs, icsFilename } from '@/lib/ics';

const EVENT = {
  uid: 'event-abc@cut-events',
  title: 'CUT Fundraising Gala Dinner',
  // 18:00 SAST
  startsAt: '2026-10-30T16:00:00.000Z',
  endsAt: '2026-10-30T21:00:00.000Z',
  location: 'CUT Hotel School, Bloemfontein',
  description: 'An evening in support of the CUT Annual Fund.',
  url: 'https://cut-events.test/rsvp/r.aaa.bbb',
};

function lines(ics: string): string[] {
  return ics.split('\r\n');
}

describe('buildIcs', () => {
  it('produces a calendar with one event, CRLF throughout', () => {
    const ics = buildIcs(EVENT);
    expect(ics.includes('\n') && !ics.includes('\r\n\r\n')).toBe(true);
    expect(lines(ics)[0]).toBe('BEGIN:VCALENDAR');
    expect(lines(ics)).toContain('BEGIN:VEVENT');
    expect(lines(ics)).toContain('END:VEVENT');
    expect(lines(ics)).toContain('END:VCALENDAR');
    // A bare LF anywhere would break older Outlook.
    expect(/[^\r]\n/.test(ics)).toBe(false);
  });

  it('writes times as UTC, which is 18:00 in Johannesburg', () => {
    expect(lines(buildIcs(EVENT))).toContain('DTSTART:20261030T160000Z');
    expect(lines(buildIcs(EVENT))).toContain('DTEND:20261030T210000Z');
  });

  it('gives an event with no stated end a three-hour block', () => {
    const ics = buildIcs({ ...EVENT, endsAt: null });
    expect(lines(ics)).toContain('DTEND:20261030T190000Z');
  });

  it('escapes commas, semicolons and backslashes in text', () => {
    const ics = buildIcs({
      ...EVENT,
      title: 'Gala; dinner, drinks \\ dancing',
      location: null,
      description: null,
    });
    expect(lines(ics)).toContain('SUMMARY:Gala\\; dinner\\, drinks \\\\ dancing');
  });

  it('turns a newline in the description into the literal \\n the RFC wants', () => {
    const ics = buildIcs({ ...EVENT, description: 'First line\nSecond line' });
    expect(ics).toContain('DESCRIPTION:First line\\nSecond line');
  });

  it('folds a long line at 75 octets with a single leading space', () => {
    const long = 'A'.repeat(200);
    const folded = buildIcs({ ...EVENT, location: long });

    const all = lines(folded);
    for (const line of all) {
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
    }

    const start = all.findIndex((line) => line.startsWith('LOCATION:'));
    expect(all[start + 1]?.startsWith(' ')).toBe(true);

    // Unfolding must give the original back.
    const unfolded = all.slice(start).reduce<string[]>((acc, line) => {
      if (line.startsWith(' ')) acc[acc.length - 1] += line.slice(1);
      else acc.push(line);
      return acc;
    }, [])[0];
    expect(unfolded).toBe(`LOCATION:${long}`);
  });

  it('leaves out properties it has no value for', () => {
    const ics = buildIcs({ ...EVENT, location: null, description: null, url: null });
    expect(ics).not.toContain('LOCATION:');
    expect(ics).not.toContain('DESCRIPTION:');
    expect(ics).not.toContain('URL:');
  });
});

describe('icsFilename', () => {
  it('slugifies the event title', () => {
    expect(icsFilename('CUT Fundraising Gala Dinner (Demo)')).toBe(
      'cut-fundraising-gala-dinner-demo.ics',
    );
  });

  it('falls back rather than producing a nameless file', () => {
    expect(icsFilename('— ·')).toBe('cut-event.ics');
  });
});
