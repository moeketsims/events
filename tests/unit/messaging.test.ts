import { describe, expect, it } from 'vitest';
import { applyMergeFields, render } from '@/lib/messaging/templates';
import { signSvix, verifySvixSignature } from '@/lib/messaging/svix';

const DATA = {
  firstName: 'Naledi',
  lastName: 'Mokoena',
  eventTitle: 'CUT Fundraising Gala Dinner',
  startsAt: 'Friday 30 October 2026, 18:00',
  venue: 'CUT Hotel School, Bloemfontein',
  rsvpUrl: 'https://cut-events.test/rsvp/r.aaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbbbb',
  passUrl: 'https://cut-events.test/p/p.aaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbbbb',
};

describe('applyMergeFields', () => {
  it('substitutes every field the invitation editor offers', () => {
    const text = applyMergeFields(
      'Dear {{first_name}} {{last_name}}, join us at {{event_title}} on {{starts_at}} at {{venue}}. Reply: {{rsvp_url}}',
      DATA,
    );
    expect(text).toBe(
      `Dear Naledi Mokoena, join us at CUT Fundraising Gala Dinner on Friday 30 October 2026, 18:00 at CUT Hotel School, Bloemfontein. Reply: ${DATA.rsvpUrl}`,
    );
  });

  it('tolerates spaces inside the braces', () => {
    expect(applyMergeFields('Hello {{ first_name }}', DATA)).toBe('Hello Naledi');
  });

  it('renders an absent field as nothing rather than "undefined"', () => {
    expect(applyMergeFields('Venue: {{venue}}.', { firstName: 'A' })).toBe('Venue: .');
  });

  it('leaves a field it does not know alone, so a typo is visible', () => {
    expect(applyMergeFields('Hello {{frist_name}}', DATA)).toBe('Hello {{frist_name}}');
  });
});

describe('render', () => {
  it('builds an invitation with the RSVP link in every rendering', () => {
    const message = render('invite', DATA);
    expect(message.subject).toBe('You are invited: CUT Fundraising Gala Dinner');
    expect(message.html).toContain(DATA.rsvpUrl);
    expect(message.text).toContain(DATA.rsvpUrl);
    expect(message.whatsappText).toContain(DATA.rsvpUrl);
    expect(message.html).toContain('Dear Naledi');
  });

  it('applies merge fields the organiser typed into the invitation body', () => {
    const message = render('invite', {
      ...DATA,
      body: 'We would love to see you, {{first_name}}.',
    });
    expect(message.text).toContain('We would love to see you, Naledi.');
    expect(message.html).toContain('We would love to see you, Naledi.');
  });

  it('escapes HTML in data so a pasted tag cannot reach an inbox as markup', () => {
    const message = render('invite', {
      ...DATA,
      eventTitle: 'Gala <script>alert(1)</script> & Dinner',
    });
    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('&lt;script&gt;');
    expect(message.html).toContain('&amp;');
  });

  it('sends the pass QR as an image on WhatsApp and inside the email', () => {
    const message = render('pass', { ...DATA, qrImageUrl: 'https://cdn.test/passes/x.png' });
    expect(message.whatsappImageUrl).toBe('https://cdn.test/passes/x.png');
    expect(message.html).toContain('alt="Your entry pass QR code"');
    expect(message.whatsappText).toContain(DATA.passUrl);
  });

  it('carries the Section 18A line on the winner and receipt messages', () => {
    const won = render('winner', { ...DATA, lotTitle: 'Signed jersey', amount: 'R1 750' });
    expect(won.subject).toBe('You have won Signed jersey');
    expect(won.html).toContain('Section 18A');
    expect(
      render('receipt', { ...DATA, lotTitle: 'Signed jersey', amount: 'R1 750' }).html,
    ).toContain('Section 18A');
  });

  it('puts the motto and both campus switchboards in every email footer', () => {
    for (const kind of ['invite', 'pass', 'broadcast', 'winner'] as const) {
      const html = render(kind, { ...DATA, body: 'Dinner is served.' }).html;
      expect(html).toContain('Thinking Beyond');
      expect(html).toContain('+27 51 507 3911');
      expect(html).toContain('+27 57 910 3500');
    }
  });
});

describe('verifySvixSignature', () => {
  const secret = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';
  const id = 'msg_p5jXN8AQM9LWM0D4loKWxJek';
  const now = 1_700_000_000_000;
  const timestamp = String(now / 1000);
  const body = '{"type":"email.delivered","data":{"email_id":"abc"}}';

  it('accepts a signature Svix would have produced', () => {
    const signatureHeader = signSvix({ secret, id, timestamp, body });
    expect(verifySvixSignature({ secret, id, timestamp, signatureHeader, body, now })).toBe(true);
  });

  it('accepts a header carrying several signatures, as during a rotation', () => {
    const good = signSvix({ secret, id, timestamp, body });
    const header = `v1,ZZZZZZZZZZZZZZZZZZZZZZZZZZZZ ${good}`;
    expect(verifySvixSignature({ secret, id, timestamp, signatureHeader: header, body, now })).toBe(
      true,
    );
  });

  it('rejects a body that changed after signing', () => {
    const signatureHeader = signSvix({ secret, id, timestamp, body });
    expect(
      verifySvixSignature({
        secret,
        id,
        timestamp,
        signatureHeader,
        body: body.replace('delivered', 'opened'),
        now,
      }),
    ).toBe(false);
  });

  it('rejects the wrong secret and the wrong message id', () => {
    const signatureHeader = signSvix({ secret, id, timestamp, body });
    expect(
      verifySvixSignature({ secret: 'whsec_AAAA', id, timestamp, signatureHeader, body, now }),
    ).toBe(false);
    expect(
      verifySvixSignature({ secret, id: 'msg_other', timestamp, signatureHeader, body, now }),
    ).toBe(false);
  });

  it('rejects a replay outside the five-minute window', () => {
    const signatureHeader = signSvix({ secret, id, timestamp, body });
    expect(
      verifySvixSignature({
        secret,
        id,
        timestamp,
        signatureHeader,
        body,
        now: now + 6 * 60 * 1000,
      }),
    ).toBe(false);
  });

  it('rejects a malformed header rather than throwing', () => {
    expect(
      verifySvixSignature({ secret, id, timestamp, signatureHeader: 'nonsense', body, now }),
    ).toBe(false);
    expect(verifySvixSignature({ secret, id, timestamp, signatureHeader: '', body, now })).toBe(
      false,
    );
  });
});
