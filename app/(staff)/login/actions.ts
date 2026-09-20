'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const emailSchema = z.object({
  email: z.email('Enter a valid email address').transform((v) => v.trim().toLowerCase()),
});

const verifySchema = emailSchema.extend({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'The code is six digits'),
  next: z.string().startsWith('/').optional(),
});

export type LoginState = {
  step: 'request' | 'verify';
  email?: string;
  error?: string;
  notice?: string;
};

/**
 * Step one: send a six-digit code.
 *
 * `shouldCreateUser: false` matters. Staff accounts are created by the seed or
 * by a platform admin in /settings; without it, a typo in an email address
 * would silently create an account with no department and no role.
 */
export async function requestOtp(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return {
      step: 'request',
      error: parsed.error.issues[0]?.message ?? 'Enter a valid email address',
    };
  }

  const { email } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  if (error) {
    // Do not distinguish "no such account" from "send failed": that would let
    // anyone enumerate which CUT addresses are registered.
    console.error('requestOtp failed', error.message);
    return {
      step: 'request',
      email,
      error: 'That code could not be sent. Check the address, or ask a platform admin to add you.',
    };
  }

  return { step: 'verify', email, notice: `We sent a six-digit code to ${email}.` };
}

/** Step two: exchange the code for a session. */
export async function verifyOtp(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = verifySchema.safeParse({
    email: formData.get('email'),
    code: formData.get('code'),
    next: formData.get('next') || undefined,
  });

  if (!parsed.success) {
    return {
      step: 'verify',
      email: String(formData.get('email') ?? ''),
      error: parsed.error.issues[0]?.message ?? 'Check the code and try again',
    };
  }

  const { email, code, next } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });

  if (error) {
    return {
      step: 'verify',
      email,
      error: 'That code is wrong or has expired. Ask for a new one.',
    };
  }

  redirect(next ?? '/dashboard');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
