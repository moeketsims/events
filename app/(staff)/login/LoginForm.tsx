'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { requestOtp, verifyOtp, type LoginState } from './actions';

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-12 w-full" disabled={pending}>
      {pending ? 'One moment…' : children}
    </Button>
  );
}

function Message({ state }: { state: LoginState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-md bg-red-700/10 p-3 text-sm text-red-700">
        {state.error}
      </p>
    );
  }
  if (state.notice) {
    return (
      <p role="status" className="bg-cut-100 text-cut-900 rounded-md p-3 text-sm">
        {state.notice}
      </p>
    );
  }
  return null;
}

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
      <form action={requestAction} className="space-y-4">
        <Message state={requestState} />

        <div className="space-y-1.5">
          <Label htmlFor="email">CUT email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            autoFocus
            placeholder="you@cut.ac.za"
            defaultValue={requestState.email}
            className="h-12"
          />
        </div>

        <SubmitButton>Email me a code</SubmitButton>

        <p className="text-ink-500 text-sm">
          There is no password. We send a six-digit code that is valid for a few minutes.
        </p>
      </form>
    );
  }

  return (
    <form action={verifyAction} className="space-y-4">
      <Message state={verifyState.error || verifyState.notice ? verifyState : requestState} />

      <input type="hidden" name="email" value={email ?? ''} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="space-y-1.5">
        <Label htmlFor="code">Six-digit code</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          placeholder="000000"
          className="tabular h-12 text-center text-2xl tracking-[0.4em]"
        />
      </div>

      <SubmitButton>Sign in</SubmitButton>

      <p className="text-ink-500 text-sm">
        Sent to {email}.{' '}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-cut-700 underline"
        >
          Use a different address
        </button>
      </p>
    </form>
  );
}
