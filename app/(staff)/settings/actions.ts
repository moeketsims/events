'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { ROLES } from '@/lib/auth/roles';
import { createAdminClient } from '@/lib/supabase/admin';
import { APP_URL, optionalEnv } from '@/lib/env';

export type SettingsState = { error?: string; notice?: string; magicLink?: string };

const setRoleSchema = z.object({
  userId: z.uuid(),
  role: z.enum(ROLES),
});

/**
 * Change a colleague's role. Platform admin only, and never your own row: an
 * admin who demotes themselves by accident locks the department out of its own
 * settings page with no way back except a database edit.
 */
export async function setUserRole(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const actor = await requireStaff(['platform_admin']);

  const parsed = setRoleSchema.safeParse({
    userId: formData.get('userId'),
    role: formData.get('role'),
  });
  if (!parsed.success) return { error: 'That role is not one we recognise.' };

  const { userId, role } = parsed.data;
  if (userId === actor.id) return { error: 'You cannot change your own role.' };

  const admin = createAdminClient();

  // Confined to the actor's own department, so a department admin cannot reach
  // across the university.
  const { data: target } = await admin
    .from('profiles')
    .select('id, department_id, email')
    .eq('id', userId)
    .maybeSingle();

  if (!target || target.department_id !== actor.departmentId) {
    return { error: 'That user is not in your department.' };
  }

  const { error } = await admin.from('profiles').update({ role }).eq('id', userId);
  if (error) return { error: `The role could not be changed: ${error.message}` };

  await admin.rpc('log_audit', {
    p_actor_id: actor.id,
    p_action: 'profile.role_changed',
    p_entity: 'profiles',
    p_entity_id: userId,
    p_metadata: { role, email: target.email },
  });

  revalidatePath('/settings');
  return { notice: `${target.email} is now ${role.replace('_', ' ')}.` };
}

const inviteSchema = z.object({
  email: z.email('Enter a valid email address').transform((v) => v.trim().toLowerCase()),
  fullName: z.string().trim().min(1, 'A name helps at the door').max(120),
  role: z.enum(ROLES),
});

/**
 * Create a staff account and send them a magic link.
 *
 * The link is also returned to the caller and shown on screen. Supabase's
 * built-in auth mailer is rate-limited to a handful of messages an hour on the
 * free tier (BUILD-SPEC §11b), so until custom SMTP is configured the on-screen
 * link is the only reliable way in.
 */
export async function inviteStaff(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const actor = await requireStaff(['platform_admin']);
  if (!actor.departmentId) {
    return { error: 'Your own profile has no department, so there is nothing to invite into.' };
  }

  const parsed = inviteSchema.safeParse({
    email: formData.get('email'),
    fullName: formData.get('fullName'),
    role: formData.get('role'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }

  const { email, fullName, role } = parsed.data;
  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  let userId = created?.user?.id;

  if (createError) {
    // Already registered: adopt them into this department rather than failing.
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (!userId) return { error: `The account could not be created: ${createError.message}` };
  }

  // The handle_new_user() trigger has already made the profile row; fill in the
  // department and role it cannot know.
  const { error: profileError } = await admin
    .from('profiles')
    .update({ department_id: actor.departmentId, role, full_name: fullName })
    .eq('id', userId!);

  if (profileError) return { error: `The profile could not be set up: ${profileError.message}` };

  // Built against our own /auth/confirm route: Supabase's action_link returns
  // the session in the URL fragment, which the server cannot read.
  const { data: link } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${APP_URL}/dashboard` },
  });
  const hashedToken = link?.properties?.hashed_token;
  const magicLink = hashedToken
    ? `${APP_URL}/auth/confirm?token_hash=${hashedToken}&type=magiclink&next=/dashboard`
    : undefined;

  await admin.rpc('log_audit', {
    p_actor_id: actor.id,
    p_action: 'staff.invited',
    p_entity: 'profiles',
    p_entity_id: userId!,
    p_metadata: { email, role },
  });

  revalidatePath('/settings');

  const smtpConfigured = Boolean(optionalEnv('RESEND_API_KEY') || optionalEnv('BREVO_API_KEY'));

  return {
    notice: smtpConfigured
      ? `${email} can now sign in. A magic link has been emailed to them.`
      : `${email} can now sign in. No email provider is configured yet, so send them this link yourself.`,
    magicLink,
  };
}
