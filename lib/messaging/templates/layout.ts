import { APP_URL } from '@/lib/env';

/**
 * The email chrome — DESIGN-SYSTEM §5.5. A 600 px table, because that is what
 * Outlook renders reliably; the logo on white, because CUT's identity has no
 * reversed version and the rule is that it lives on a white plate; a 6 px CUT
 * Blue rule under the header; and a footer carrying the full university name,
 * both campus switchboards and the motto.
 *
 * Every colour is a literal hex. An email client has no access to the CSS
 * custom properties in globals.css, and Gmail strips `<style>` blocks, so the
 * tokens have to be written out here and kept in step with DESIGN-SYSTEM §2.2
 * by hand.
 */

const CUT_BLUE = '#003261';
const INK_700 = '#374151';
const INK_500 = '#6B7280';
const INK_300 = '#D1D5DB';

/** The logo has to be an absolute URL: an email is read away from the app. */
function logoUrl(): string {
  return `${APP_URL}/brand/logo-h-md.png`;
}

export function emailLayout(input: { preheader: string; body: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CUT Events</title>
</head>
<body style="margin:0;padding:0;background:#F4F6F9;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#FFFFFF;border-collapse:collapse;">
        <tr>
          <td style="padding:24px 32px 20px 32px;">
            <img src="${logoUrl()}" width="180" alt="Central University of Technology, Free State" style="display:block;border:0;width:180px;height:auto;">
          </td>
        </tr>
        <tr><td style="height:6px;background:${CUT_BLUE};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr>
          <td style="padding:32px;font-family:'Source Sans 3',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:${INK_700};">
            ${input.body}
          </td>
        </tr>
        <tr><td style="height:1px;background:${INK_300};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr>
          <td style="padding:20px 32px 28px 32px;font-family:'Source Sans 3',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:${INK_500};">
            <p style="margin:0 0 6px 0;color:${CUT_BLUE};font-weight:700;letter-spacing:0.04em;">Thinking Beyond</p>
            <p style="margin:0 0 6px 0;">Central University of Technology, Free State · Institutional Advancement</p>
            <p style="margin:0 0 6px 0;">Bloemfontein +27 51 507 3911 · Welkom +27 57 910 3500 · <a href="https://www.cut.ac.za" style="color:${CUT_BLUE};">www.cut.ac.za</a></p>
            <p style="margin:0;">You are receiving this because you are on the guest list for a CUT event. Reply to this message to be taken off it.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** The one primary action in an email: 48 px tall, CUT Blue, white label. */
export function emailButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td style="background:${CUT_BLUE};">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:0 28px;height:48px;line-height:48px;font-family:'Source Sans 3',Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

export function emailHeading(text: string): string {
  return `<h1 style="margin:0 0 16px 0;font-family:'Barlow Condensed','Arial Narrow',Helvetica,Arial,sans-serif;font-size:32px;line-height:1.15;font-weight:700;color:${CUT_BLUE};">${escapeHtml(text)}</h1>`;
}

export function emailParagraph(html: string): string {
  return `<p style="margin:0 0 14px 0;">${html}</p>`;
}

/** Label/value lines for the event details block. */
export function emailDetails(rows: { label: string; value: string }[]): string {
  const cells = rows
    .filter((row) => row.value)
    .map(
      (row) =>
        `<tr>
          <td style="padding:4px 16px 4px 0;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:${INK_500};white-space:nowrap;vertical-align:top;">${escapeHtml(row.label)}</td>
          <td style="padding:4px 0;color:${INK_700};">${escapeHtml(row.value)}</td>
        </tr>`,
    )
    .join('');

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;border-collapse:collapse;">${cells}</table>`;
}

/**
 * Escape for HTML text and attribute contexts. Template data comes from a
 * contact record and an event title, both of which an organiser types; an
 * apostrophe in a venue name must not break the markup, and a script tag in a
 * pasted description must not travel to a guest's inbox.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
