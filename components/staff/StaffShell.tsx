import Link from 'next/link';
import { CalendarDays, LayoutDashboard, QrCode, Settings, Users } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { signOut } from '@/app/(staff)/login/actions';
import { ROLE_LABELS, hasRole, type StaffProfile } from '@/lib/auth/staff';

/**
 * The staff console frame. DESIGN-SYSTEM §5.1: a 240 px cut-900 sidebar with
 * the logo on a white plate, collapsing to a top bar below 1024 px, and a
 * content area capped at 1280 px with 24 px gutters.
 */

// `roles` is the set that may see the link at all. platform_admin passes every
// check, so it is never listed. A link nobody in this role can follow is worse
// than no link: it ends in a 403 that reads as a bug.
const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: null },
  { href: '/events', label: 'Events', icon: CalendarDays, roles: null },
  { href: '/contacts', label: 'Contacts', icon: Users, roles: ['organiser', 'finance'] },
  { href: '/scan', label: 'Scanner', icon: QrCode, roles: ['organiser', 'door_staff'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: [] },
] as const;

export function StaffShell({
  profile,
  children,
}: {
  profile: StaffProfile;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-cut-50 min-h-dvh lg:flex">
      {/* Column layout with mt-auto on the footer, rather than absolute
          positioning: an absolutely placed bottom-0 block overlaps the content
          when the nav is long, and lands underneath the Next dev-tools
          indicator in the bottom-left corner. */}
      <aside className="bg-cut-900 text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:shrink-0 lg:flex-col">
        <div className="flex items-center justify-between gap-4 p-4 lg:block">
          <Link href="/dashboard" aria-label="CUT Events dashboard">
            <Logo variant="horizontal" size="sm" plate priority />
          </Link>

          <nav className="flex gap-1 overflow-x-auto lg:mt-6 lg:flex-col lg:overflow-visible">
            {NAV.filter((item) => item.roles === null || hasRole(profile, item.roles)).map(
              ({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-cut-100 hover:bg-cut-800 flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors hover:text-white"
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {label}
                </Link>
              ),
            )}
          </nav>
        </div>

        <div className="border-cut-700 border-t p-4 text-sm lg:mt-auto">
          <p className="truncate font-semibold text-white">
            {profile.fullName ?? profile.email ?? 'Signed in'}
          </p>
          <p className="text-cut-100 truncate">{ROLE_LABELS[profile.role]}</p>
          {profile.departmentName ? (
            <p className="text-cut-100 truncate text-xs">{profile.departmentName}</p>
          ) : null}
          <form action={signOut}>
            <button
              type="submit"
              className="text-cut-100 hover:bg-cut-800 mt-2 inline-flex min-h-11 items-center rounded-md px-2 underline transition-colors hover:text-white"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-8">{children}</main>
    </div>
  );
}

/** Page header: breadcrumb above, H1 left, primary action right. */
export function PageHeader({
  title,
  breadcrumb,
  description,
  action,
}: {
  title: string;
  breadcrumb?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-8">
      {breadcrumb ? <p className="label-caps text-ink-500 mb-1">{breadcrumb}</p> : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-cut-900">{title}</h1>
          {description ? <p className="measure text-ink-700 mt-1">{description}</p> : null}
        </div>
        {action}
      </div>
    </header>
  );
}

/** Funnel number on an event overview. DESIGN-SYSTEM §5.1. */
export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="border-ink-300 rounded-lg border bg-white p-4">
      <p className="label-caps text-ink-500">{label}</p>
      <p className="tabular text-cut-900 mt-1 text-[2rem] leading-none font-semibold">{value}</p>
      {hint ? <p className="text-ink-500 mt-1 text-sm">{hint}</p> : null}
    </div>
  );
}
