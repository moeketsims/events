import type { MessageKind, RenderedMessage, TemplateData } from '../types';
import {
  emailButton,
  emailDetails,
  emailHeading,
  emailLayout,
  emailParagraph,
  escapeHtml,
} from './layout';

/**
 * One renderer per message kind — BUILD-SPEC §8.
 *
 * Copy follows DESIGN-SYSTEM §6: warm, formal, brief, second person, amounts as
 * `R2 500`, dates as `Friday 30 October 2026, 18:00`. The caller formats dates
 * and amounts before they arrive here, so a template never reaches for a locale.
 */

/** The merge fields an organiser may type into the invitation editor. */
export const MERGE_FIELDS = [
  '{{first_name}}',
  '{{last_name}}',
  '{{event_title}}',
  '{{starts_at}}',
  '{{venue}}',
  '{{rsvp_url}}',
] as const;

/** Substitute `{{field}}` from the template data; unknown fields are left alone. */
export function applyMergeFields(text: string, data: TemplateData): string {
  const values: Record<string, string> = {
    first_name: data.firstName ?? '',
    last_name: data.lastName ?? '',
    event_title: data.eventTitle ?? '',
    starts_at: data.startsAt ?? '',
    venue: data.venue ?? '',
    rsvp_url: data.rsvpUrl ?? '',
    pass_url: data.passUrl ?? '',
  };

  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (whole, field: string) =>
    field in values ? (values[field] ?? '') : whole,
  );
}

const DEFAULT_INVITE_BODY =
  'Institutional Advancement invites you to {{event_title}}. ' +
  'Let us know whether you can join us, and we will send your entry pass straight away.';

function invite(data: TemplateData): RenderedMessage {
  const first = data.firstName ?? 'there';
  const title = data.eventTitle ?? 'a CUT event';
  const rsvpUrl = data.rsvpUrl ?? '';
  const body = applyMergeFields(data.body?.trim() || DEFAULT_INVITE_BODY, data);

  return {
    subject: `You are invited: ${title}`,
    html: emailLayout({
      preheader: `${title} — ${data.startsAt ?? ''}`,
      body: [
        emailHeading(`Dear ${first},`),
        ...body
          .split(/\n{2,}/)
          .map((paragraph) => emailParagraph(escapeHtml(paragraph).replace(/\n/g, '<br>'))),
        emailDetails([
          { label: 'Event', value: title },
          { label: 'When', value: data.startsAt ?? '' },
          { label: 'Where', value: data.venue ?? '' },
        ]),
        emailButton(rsvpUrl, 'Reply to this invitation'),
        emailParagraph(
          `If the button does not work, open this link:<br><a href="${escapeHtml(rsvpUrl)}" style="color:#003261;word-break:break-all;">${escapeHtml(rsvpUrl)}</a>`,
        ),
      ].join(''),
    }),
    text: [
      `Dear ${first},`,
      '',
      body,
      '',
      `Event: ${title}`,
      data.startsAt ? `When: ${data.startsAt}` : '',
      data.venue ? `Where: ${data.venue}` : '',
      '',
      `Reply to this invitation: ${rsvpUrl}`,
      '',
      'Central University of Technology, Free State — Thinking Beyond',
    ]
      .filter((line) => line !== '')
      .join('\n'),
    whatsappText: [
      `Dear ${first},`,
      '',
      body,
      '',
      `*${title}*`,
      data.startsAt ? data.startsAt : '',
      data.venue ? data.venue : '',
      '',
      `Reply here: ${rsvpUrl}`,
    ]
      .filter((line, i, all) => !(line === '' && all[i - 1] === ''))
      .join('\n'),
  };
}

function pass(data: TemplateData): RenderedMessage {
  const first = data.firstName ?? 'there';
  const title = data.eventTitle ?? 'a CUT event';
  const passUrl = data.passUrl ?? '';

  return {
    subject: `Your pass for ${title}`,
    html: emailLayout({
      preheader: `Your entry pass for ${title}`,
      body: [
        emailHeading(`You are on the list, ${first}.`),
        emailParagraph('Show this QR code at the door. There is nothing to install.'),
        data.qrImageUrl
          ? `<div style="margin:24px 0;"><img src="${escapeHtml(data.qrImageUrl)}" width="240" height="240" alt="Your entry pass QR code" style="display:block;border:4px solid #003261;width:240px;height:240px;"></div>`
          : '',
        emailDetails([
          { label: 'Event', value: title },
          { label: 'When', value: data.startsAt ?? '' },
          { label: 'Where', value: data.venue ?? '' },
        ]),
        emailButton(passUrl, 'Open your pass'),
        emailParagraph(
          `Keep this link; it is your pass:<br><a href="${escapeHtml(passUrl)}" style="color:#003261;word-break:break-all;">${escapeHtml(passUrl)}</a>`,
        ),
      ].join(''),
    }),
    text: [
      `You are on the list, ${first}.`,
      '',
      'Show the QR code on your pass page at the door. There is nothing to install.',
      '',
      `Event: ${title}`,
      data.startsAt ? `When: ${data.startsAt}` : '',
      data.venue ? `Where: ${data.venue}` : '',
      '',
      `Your pass: ${passUrl}`,
    ]
      .filter((line) => line !== '')
      .join('\n'),
    whatsappText: [
      `You are on the list, ${first}.`,
      '',
      `*${title}*`,
      data.startsAt ? data.startsAt : '',
      data.venue ? data.venue : '',
      '',
      `Your pass — show this at the door: ${passUrl}`,
    ]
      .filter((line, i, all) => !(line === '' && all[i - 1] === ''))
      .join('\n'),
    whatsappImageUrl: data.qrImageUrl,
  };
}

function reminder(data: TemplateData): RenderedMessage {
  const base = invite(data);
  const title = data.eventTitle ?? 'a CUT event';
  return {
    ...base,
    subject: `A reminder: ${title}`,
  };
}

function broadcast(data: TemplateData): RenderedMessage {
  const title = data.eventTitle ?? 'a CUT event';
  const message = data.body ?? '';

  return {
    subject: `${title}: an update`,
    html: emailLayout({
      preheader: message.slice(0, 120),
      body: [
        emailHeading(title),
        ...message
          .split(/\n{2,}/)
          .map((paragraph) => emailParagraph(escapeHtml(paragraph).replace(/\n/g, '<br>'))),
        data.passUrl ? emailButton(data.passUrl, 'Open your pass') : '',
      ].join(''),
    }),
    text: [title, '', message, ...(data.passUrl ? ['', `Your pass: ${data.passUrl}`] : [])].join(
      '\n',
    ),
    whatsappText: [
      `*${title}*`,
      '',
      message,
      ...(data.passUrl ? ['', `Your pass: ${data.passUrl}`] : []),
    ].join('\n'),
  };
}

function outbid(data: TemplateData): RenderedMessage {
  const lot = data.lotTitle ?? 'a lot';
  const amount = data.amount ?? '';
  const message = `Someone has bid ${amount} on ${lot}. You can still take the lead from your bidding page.`;

  return {
    subject: `You have been outbid on ${lot}`,
    html: emailLayout({
      preheader: message,
      body: [
        emailHeading('You have been outbid.'),
        emailParagraph(escapeHtml(message)),
        data.passUrl ? emailButton(`${data.passUrl}/auction`, 'Place another bid') : '',
      ].join(''),
    }),
    text: message,
    whatsappText: message,
  };
}

function winner(data: TemplateData): RenderedMessage {
  const lot = data.lotTitle ?? 'your lot';
  const amount = data.amount ?? '';
  const first = data.firstName ?? 'there';
  const payUrl = data.payUrl ?? data.passUrl ?? '';
  const line = `Congratulations, ${first}. You have won ${lot} at ${amount}.`;

  return {
    subject: `You have won ${lot}`,
    html: emailLayout({
      preheader: line,
      body: [
        emailHeading('Congratulations.'),
        emailParagraph(escapeHtml(line)),
        emailParagraph('Payment is due within seven days. You can settle it now:'),
        payUrl ? emailButton(payUrl, `Pay ${amount}`) : '',
        emailParagraph(
          'CUT is a public benefit organisation; a Section 18A certificate can be issued on request.',
        ),
      ].join(''),
    }),
    text: [line, '', 'Payment is due within seven days.', payUrl ? `Pay here: ${payUrl}` : '']
      .filter(Boolean)
      .join('\n'),
    whatsappText: [line, '', payUrl ? `Pay here: ${payUrl}` : ''].filter(Boolean).join('\n'),
  };
}

function receipt(data: TemplateData): RenderedMessage {
  const lot = data.lotTitle ?? 'your lot';
  const amount = data.amount ?? '';
  const line = `We have received ${amount} for ${lot}. Thank you for supporting CUT.`;

  return {
    subject: `Receipt: ${lot}`,
    html: emailLayout({
      preheader: line,
      body: [
        emailHeading('Thank you.'),
        emailParagraph(escapeHtml(line)),
        emailParagraph(
          'CUT is a public benefit organisation; a Section 18A certificate can be issued for the qualifying portion of this payment on request.',
        ),
      ].join(''),
    }),
    text: line,
    whatsappText: line,
  };
}

const RENDERERS: Record<MessageKind, (data: TemplateData) => RenderedMessage> = {
  invite,
  reminder,
  pass,
  broadcast,
  outbid,
  winner,
  receipt,
};

export function render(kind: MessageKind, data: TemplateData): RenderedMessage {
  return RENDERERS[kind](data);
}

export { DEFAULT_INVITE_BODY };
