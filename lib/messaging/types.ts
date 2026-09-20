import type { Database } from '@/lib/db/types';

/**
 * Shapes shared by the messaging layer and its templates. Kept out of
 * `index.ts` so a template can import a type without pulling in the providers.
 */

export type MessageKind = Database['public']['Enums']['message_kind'];
export type DeliveryChannel = Database['public']['Enums']['delivery_channel'];
export type DeliveryStatus = Database['public']['Enums']['delivery_status'];

/** What a provider hands back. `failed` is normal, not exceptional. */
export type ProviderResult = {
  status: 'sent' | 'failed';
  providerMessageId?: string;
  error?: string;
};

/** The merge fields every template may use. Undefined fields render as ''. */
export type TemplateData = {
  firstName?: string;
  lastName?: string;
  eventTitle?: string;
  startsAt?: string;
  venue?: string;
  rsvpUrl?: string;
  passUrl?: string;
  qrImageUrl?: string;
  bidderNumber?: number | null;
  body?: string;
  lotTitle?: string;
  amount?: string;
  payUrl?: string;
};

/** What a template returns: one email and one WhatsApp rendering. */
export type RenderedMessage = {
  subject: string;
  html: string;
  text: string;
  whatsappText: string;
  /** A public image URL to send with the WhatsApp message, for the pass QR. */
  whatsappImageUrl?: string;
};

export type SendInput = {
  kind: MessageKind;
  channel: DeliveryChannel;
  eventId: string;
  contactId?: string | null;
  attendeeId?: string | null;
  broadcastId?: string | null;
  to: { email?: string | null; phone?: string | null };
  data: TemplateData;
};

export type SendResult = {
  deliveryId: string | null;
  providerMessageId?: string;
  status: 'sent' | 'failed';
  error?: string;
};
