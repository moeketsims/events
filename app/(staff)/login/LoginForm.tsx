'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { requestOtp, verifyOtp, type LoginState } from './actions';

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="gold"
      className="h-13 w-full text-[0.9375rem] font-semibold"
      disabled={pending}
    >
      {pending ? 'One moment…' : children}
      {!pending ? <ArrowRight className="size-4" aria-hidden /> : null}
    </Button>
  );
}

function Message({ state }: { state: LoginState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg border border-red-700/40 bg-red-700/15 p-3 text-sm text-red-100">
        {state.error}
      </p>
    );
  }
  if (state.notice) {
    return (
      <p role="status" className="border-gold-500/30 bg-gold-500/10 rounded-lg border p-3 text-sm text-white/85">
        {state.notice}
      </p>
    );
  }
  return null;
}

const INPUT = 'input-dark h-13 w-full rounded-lg px-4 text-[0.9375rem]';

export function LoginForm({ next }: { next?: string }) {
  const [requestState, requestAction] = useActionState<LoginState, FormData>(requestOtp, {
    step: 'request',
  });
  const [verifyState, verifyAction] = useActionState<LoginState, FormData>(verifyOtp, {
    step: 'verify',
  });

  // Once a code has been sent we show the code form, keeping the address that
  // was used so the second call verifies against the same one.
  const email = verifyState.email ?? requestState.email;
  const onCodeStep = requestState.step === 'verify';

  if (!onCodeStep) {
    return (
      <form action={requestAction} className="space-y-5">
        <Message state={requestState} />

        <div className="space-y-2">
          <Label htmlFor="email" className="text-[0.8125rem] font-semibold tracking-wide text-white/70">
            CUT email address
          </Label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            autoFocus
            placeholder="you@cut.ac.za"
            defaultValue={requestState.email}
            className={INPUT}
          />
        </div>

        <SubmitButton>Email me a code</SubmitButton>

        <p className="text-sm text-white/50">
          There is no password. We send a six-digit code that is valid for a few minutes.
        </p>
      </form>
    );
  }

  return (
    <form action={verifyAction} className="space-y-5">
      <Message state={verifyState.error || verifyState.notice ? verifyState : requestState} />

      <input type="hidden" name="email" value={email ?? ''} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="space-y-2">
        <Label htmlFor="code" className="text-[0.8125rem] font-semibold tracking-wide text-white/70">
          Six-digit code
        </Label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          placeholder="000000"
          className={cn(INPUT, 'numeral text-center text-[2rem] tracking-[0.35em]')}
        />
      </div>

      <SubmitButton>Sign in</SubmitButton>

      <p className="text-sm text-white/50">
        Sent to <span className="text-white/80">{email}</span>.{' '}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-gold-500 underline underline-offset-4 hover:text-gold-600"
        >
          Use a different address
        </button>
      </p>
    </form>
  );
}
