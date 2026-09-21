import { describe, expect, it } from 'vitest';
import { CONSENT_SOURCE, CONSENT_VERSION, consentWording } from '@/lib/consent';

describe('consent', () => {
  it('records self-registration under its own source', () => {
    expect(CONSENT_SOURCE.selfRegistration).toBe('self_registration');
  });

  it('keeps the v1 wording verbatim — the POPIA record depends on it', () => {
    expect(CONSENT_VERSION).toBe('v1');
    expect(consentWording()).toBe(
      'I agree that Central University of Technology, Free State may contact me about this ' +
        'event by email and, if I have provided my number, by WhatsApp or SMS. I can withdraw ' +
        'this consent at any time. CUT processes personal information in line with POPIA.',
    );
  });
});
