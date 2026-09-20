import type { Database } from '@/lib/db/types';

/**
 * Role names and labels, with no server-only imports, so client components can
 * use them. The enforcement lives in `lib/auth/staff.ts` (server) and in the
 * RLS policies (database); nothing here decides access.
 */

export type UserRole = Database['public']['Enums']['user_role'];

// A const tuple, not readonly UserRole[]: zod's z.enum() needs the literal
// members, and `satisfies` still fails the build if the database enum changes
// and a value here stops being valid.
export const ROLES = [
  'organiser',
  'door_staff',
  'auction_operator',
  'finance',
  'platform_admin',
] as const satisfies readonly UserRole[];

export const ROLE_LABELS: Record<UserRole, string> = {
  platform_admin: 'Platform admin',
  organiser: 'Event organiser',
  door_staff: 'Door staff',
  auction_operator: 'Auction operator',
  finance: 'Finance',
};
