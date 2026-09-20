import 'server-only';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/auth/roles';

// Re-exported so server components have one import for both. Client components
// must import from '@/lib/auth/roles' directly: this module is server-only and
// pulling it into a client bundle is a build error.
export { ROLES, ROLE_LABELS, type UserRole } from '@/lib/auth/roles';

export type StaffProfile = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: UserRole;
  departmentId: string | null;
  departmentName: string | null;
};

/** Thrown when a signed-in user holds the wrong role. Rendered as a 403. */
export class ForbiddenError extends Error {
  constructor(public readonly required: readonly UserRole[]) {
    super(`Requires one of: ${required.join(', ')}`);
    this.name = 'ForbiddenError';
  }
}

/** The signed-in staff profile, or null. Never redirects. */
export async function getStaffProfile(): Promise<StaffProfile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, department_id, departments(name)')
    .eq('id', user.id)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    role: data.role,
    departmentId: data.department_id,
    departmentName: data.departments?.name ?? null,
  };
}

/**
 * The gate on every staff surface and every role-restricted Server Action.
 *
 * No session at all sends the visitor to /login with a return path. A session
 * with the wrong role raises ForbiddenError, which the route's error boundary
 * renders as a 403 — deliberately different from a redirect, so a door-staff
 * member who lands on an organiser page is told they lack the role rather than
 * being asked to sign in again as themselves.
 */
export async function requireStaff(roles?: readonly UserRole[]): Promise<StaffProfile> {
  const profile = await getStaffProfile();

  if (!profile) redirect('/login');

  // platform_admin passes every check.
  if (roles && roles.length > 0 && profile.role !== 'platform_admin') {
    if (!roles.includes(profile.role)) throw new ForbiddenError(roles);
  }

  return profile;
}

/** Non-throwing variant, for deciding whether to render a control. */
export function hasRole(profile: StaffProfile, roles: readonly UserRole[]): boolean {
  return profile.role === 'platform_admin' || roles.includes(profile.role);
}
