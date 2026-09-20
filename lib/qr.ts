import 'server-only';

import QRCode from 'qrcode';
import { createAdminClient } from '@/lib/supabase/admin';
import { APP_URL, SUPABASE_URL } from '@/lib/env';

/**
 * Pass QR codes — BUILD-SPEC §7.3 and §10.
 *
 * The code encodes the full pass URL, not a bare token, so a guest's own camera
 * app opens the pass and the scanner reads the same code. Error correction is
 * `M`: the token is 47 characters, which fits comfortably, and `M` keeps the
 * modules large enough to read from a phone screen across a table — `H` would
 * pack in a third more modules for redundancy nobody needs on a lit screen.
 */

const ERROR_CORRECTION = 'M' as const;
const BUCKET = 'passes';

export function passUrl(token: string): string {
  return `${APP_URL}/p/${token}`;
}

/** Inline SVG for the pass page. No image request, no layout shift. */
export async function passQrSvg(token: string): Promise<string> {
  return QRCode.toString(passUrl(token), {
    type: 'svg',
    errorCorrectionLevel: ERROR_CORRECTION,
    margin: 1, // the quiet zone; 1 module, scaled up by the page's own padding
    color: { dark: '#001738', light: '#FFFFFF' },
  });
}

/** PNG bytes, for email and for WhatsApp. */
export async function passQrPng(token: string): Promise<Buffer> {
  return QRCode.toBuffer(passUrl(token), {
    errorCorrectionLevel: ERROR_CORRECTION,
    margin: 2,
    width: 600,
    color: { dark: '#001738', light: '#FFFFFF' },
  });
}

/**
 * Write the PNG to the public `passes` bucket and return its URL.
 *
 * A WhatsApp image message takes a public link rather than an attachment, and
 * an email client renders a hosted image where it would block an attachment, so
 * one file serves both. Public read is acceptable because the PNG encodes only
 * a URL that already carries its own signed token: knowing an attendee's id
 * does not let anyone forge one.
 *
 * Returns null rather than throwing. A pass that could not be turned into a
 * picture is a message without an image, not a failed RSVP.
 */
export async function storePassPng(attendeeId: string, token: string): Promise<string | null> {
  try {
    const png = await passQrPng(token);
    const path = `${attendeeId}.png`;

    const { error } = await createAdminClient()
      .storage.from(BUCKET)
      .upload(path, png, { contentType: 'image/png', upsert: true });

    if (error) return null;

    // Cache-busted by the attendee id changing, never by content: the same
    // attendee's token only changes if it is deliberately revoked, and that
    // reissues the row.
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  } catch {
    return null;
  }
}
