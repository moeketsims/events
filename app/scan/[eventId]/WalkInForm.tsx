'use client';

import { useState } from 'react';
import { consentWording } from '@/lib/consent';
import type { CheckinResponse } from '@/app/api/checkin/route';

export type WalkInResult = CheckinResponse & { passPath: string | null };

/**
 * Register a guest who is not on the list — TASKS T2.6, DESIGN-SYSTEM §5.3.
 *
 * Five fields, because this happens in a queue with people behind. The consent
 * tick is the one thing that cannot be skipped: CUT may not keep this person's
 * details without it, and the wording that was on screen is stored with the
 * record.
 */
export function WalkInForm({
  eventId,
  onDone,
}: {
  eventId: string;
  onDone: (result: WalkInResult) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);

  async function onSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = formEvent.currentTarget;
    const data = new FormData(form);

    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/walkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          firstName: String(data.get('firstName') ?? ''),
          lastName: String(data.get('lastName') ?? ''),
          email: String(data.get('email') ?? ''),
          phone: String(data.get('phone') ?? ''),
          whatsappOptIn: data.get('whatsappOptIn') === 'on',
          consent: data.get('consent') === 'on',
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(typeof payload?.error === 'string' ? payload.error : 'That could not be saved.');
        return;
      }

      form.reset();
      setConsent(false);
      onDone(payload as WalkInResult);
    } catch {
      setError('The network dropped. Try once more.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      <div className="grid grid-cols-2 gap-3">
        <Field name="firstName" label="First name" required autoComplete="given-name" />
        <Field name="lastName" label="Surname" required autoComplete="family-name" />
      </div>

      <Field name="email" label="Email" type="email" autoComplete="email" />
      <Field name="phone" label="Mobile" type="tel" autoComplete="tel" placeholder="082 123 4567" />

      <label className="flex min-h-11 cursor-pointer items-center gap-3 py-1 text-sm text-white/80">
        <input type="checkbox" name="whatsappOptIn" className="accent-gold-500 size-5 shrink-0" />
        Send updates on WhatsApp
      </label>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/12 bg-white/5 p-3 text-[0.8125rem] leading-relaxed text-white/75">
        <input
          type="checkbox"
          name="consent"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="accent-gold-500 mt-0.5 size-5 shrink-0"
        />
        <span>{consentWording()}</span>
      </label>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-700/30 px-4 py-3 text-sm text-white">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || !consent}
        className="bg-gold-500 text-cut-950 hover:bg-gold-600 h-14 w-full rounded-xl text-base font-semibold transition-colors disabled:opacity-50"
      >
        {busy ? 'Registering…' : 'Register and check in'}
      </button>

      {!consent ? (
        <p className="pb-2 text-center text-xs text-white/60">
          The guest has to agree before we may keep their details.
        </p>
      ) : null}
    </form>
  );
}

function Field({
  name,
  label,
  type = 'text',
  required = false,
  autoComplete,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={`walkin-${name}`} className="mb-1.5 block text-xs text-white/60">
        {label}
        {required ? <span className="text-gold-500"> *</span> : null}
      </label>
      <input
        id={`walkin-${name}`}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="input-dark h-12 w-full rounded-lg px-3 text-base"
      />
    </div>
  );
}
