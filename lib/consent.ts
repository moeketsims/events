/**
 * Consent and terms wording — DESIGN-SYSTEM §6, versioned.
 *
 * The exact words shown to a person are part of the consent record, not
 * decoration: POPIA requires CUT to be able to say what someone agreed to, and
 * Meta requires evidence of opt-in before a WhatsApp message. So the version is
 * stored on every `consents` row, and changing the wording means adding a
 * version here, never editing one in place.
 */

export const CONSENT_VERSION = 'v1';

export const CONSENT_WORDING: Record<string, string> = {
  v1:
    'I agree that Central University of Technology, Free State may contact me about this ' +
    'event by email and, if I have provided my number, by WhatsApp or SMS. I can withdraw ' +
    'this consent at any time. CUT processes personal information in line with POPIA.',
};

export const AUCTION_TERMS_VERSION = 'v1';

export const AUCTION_TERMS: Record<string, string> = {
  v1:
    'Bids are binding offers to purchase the lot at the amount bid. The highest valid bid at ' +
    'close wins, subject to any reserve. Payment is due within 7 days. Lots are sold as ' +
    'described; CUT is not liable for donor-supplied items beyond the description. CUT is a ' +
    'public benefit organisation; a Section 18A certificate may be issued for the qualifying ' +
    'portion of a payment on request.',
};

/** The purposes recorded in `consents.purpose`. */
export const CONSENT_PURPOSE = {
  eventComms: 'event_comms',
  whatsapp: 'whatsapp',
  auctionTerms: 'auction_terms',
} as const;

/** Where the consent was captured, recorded in `consents.source`. */
export const CONSENT_SOURCE = {
  rsvpForm: 'rsvp_form',
  walkIn: 'walk_in',
  import: 'import',
  auctionBid: 'auction_bid',
  selfRegistration: 'self_registration',
} as const;

export function consentWording(version = CONSENT_VERSION): string {
  return CONSENT_WORDING[version] ?? CONSENT_WORDING.v1!;
}

export function auctionTerms(version = AUCTION_TERMS_VERSION): string {
  return AUCTION_TERMS[version] ?? AUCTION_TERMS.v1!;
}
