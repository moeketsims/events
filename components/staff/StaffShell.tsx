import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { signOut } from '@/app/(staff)/login/actions';
import { ROLE_LABELS, hasRole, type StaffProfile } from '@/lib/auth/staff';
import { NavLinks, type NavHref } from './NavLinks';
import { cn } from '@/lib/utils';

/**
 * The staff console frame — DESIGN-SYSTEM §5.1 with the v2 visual language:
 * a 268 px sidebar on the shell gradient with the CUT watermark, the logo on a
 * white plate, a gold active indicator, and a user card at the foot. Content
 * sits on the `canvas` surface, capped at 1200 px.
 */

// `roles` is the set that may see the link at all. platform_admin passes every
// check, so it is never listed. A link that ends in a 403 is worse than no link.
const NAV: { href: NavHref; roles: readonly string[] | null }[] = [
  { href: '/dashboard', roles: null },
  { href: '/events', roles: null },
  { href: '/contacts', roles: ['organiser', 'finance'] },
  { href: '/scan', roles: ['organiser', 'door_staff'] },
  { href: '/settings', roles: [] },
];

function initials(name: string | null, email: string | null): string {
  const source = (name ?? email ?? '?').trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? '';
  const second = parts[1]?.charAt(0) ?? '';
  const letters = first && second ? first + second : source.slice(0, 2);
  return letters.toUpperCase();
}

export function StaffShell({
  profile,
  children,
}: {
  profile: StaffProfile;
  children: React.ReactNode;
}) {
  const allowed = NAV.filter(
    (item) => item.roles === null || hasRole(profile, item.roles as never),
  ).map((item) => item.href);

  return (
    <div className="bg-canvas min-h-dvh lg:flex">
      <aside className="bg-shell watermark relative overflow-hidden text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-[268px] lg:shrink-0 lg:flex-col">
        {/* Below lg the nav sits on its own scrollable row under the logo, so the
            plate never squeezes the links. */}
        <div className="relative z-10 flex flex-col gap-4 px-5 pt-5 lg:block lg:px-5">
          <Link
            href="/dashboard"
            aria-label="CUT Events dashboard"
            className="shadow-plate inline-flex rounded-xl bg-white p-3 transition-transform duration-300 hover:scale-[1.01]"
          >
            <Logo variant="horizontal" size="sm" priority />
          </Link>

          <p className="mt-8 mb-2 hidden px-3 text-[0.6875rem] font-bold tracking-[0.14em] text-white/40 uppercase lg:block">
            Workspace
          </p>
          <NavLinks allowed={allowed} />
        </div>

        <div className="relative z-10 mt-auto border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="bg-gold-500 text-cut-950 font-display ring-gold-500/30 flex size-10 shrink-0 items-center justify-center rounded-full text-base font-bold ring-4"
            >
              {initials(profile.fullName, profile.email)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {profile.fullName ?? profile.email ?? 'Signed in'}
              </p>
              <p className="truncate text-xs text-white/60">
                {ROLE_LABELS[profile.role]}
                {profile.departmentName ? ` · ${profile.departmentName}` : ''}
              </p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                title="Sign out"
                aria-label="Sign out"
                className="flex size-9 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                <LogOut className="size-4" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <main className="animate-fade-up mx-auto w-full max-w-[1200px] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
          {children}
        </main>
        <footer className="text-ink-500 mx-auto w-full max-w-[1200px] px-5 pb-8 text-xs sm:px-8 lg:px-12">
          <span className="font-display text-cut-900 text-sm font-semibold tracking-wide">
            Thinking Beyond
          </span>
          <span className="text-ink-300 mx-2">·</span>
          Central University of Technology, Free State
        </footer>
      </div>
    </div>
  );
}

/** Page opener: eyebrow, display title, one-line description, primary action. */
export function PageHeader({
  title,
  breadcrumb,
  description,
  action,
  className,
}: {
  title: string;
  breadcrumb?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-10', className)}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          {breadcrumb ? <p className="eyebrow mb-3">{breadcrumb}</p> : null}
          <h1 className="text-cut-900 text-[2.5rem] leading-[1.05] font-bold tracking-tight sm:text-5xl">
            {title}
          </h1>
          {description ? (
            <p className="measure text-ink-500 mt-3 text-[1.0625rem] leading-relaxed">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}

/** Section opener inside a page. */
export function SectionHeading({
  title,
  eyebrow,
  action,
  className,
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-5 flex flex-wrap items-end justify-between gap-4', className)}>
      <div>
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h2 className="text-cut-900 text-[1.75rem] leading-none font-semibold">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/** A number that matters. Icon chip, small-caps label, display numeral, hint. */
export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'navy',
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  tone?: 'navy' | 'gold' | 'green' | 'sky';
}) {
  const chip = {
    navy: 'bg-cut-100 text-cut-900',
    gold: 'bg-gold-500/15 text-gold-600',
    green: 'bg-green-600/12 text-green-600',
    sky: 'bg-sky-500/12 text-sky-500',
  }[tone];

  return (
    <div className="card card-hover relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="label-caps text-ink-500">{label}</p>
        {icon ? (
          <span className={cn('flex size-9 items-center justify-center rounded-lg', chip)}>
            {icon}
          </span>
        ) : null}
      </div>
      <p className="numeral text-cut-900 mt-4 text-[2.75rem]">{value}</p>
      {hint ? <p className="text-ink-500 mt-2 text-sm">{hint}</p> : null}
    </div>
  );
}

/**
 * Status pill for event, invitation and lot states — DESIGN-SYSTEM §2.4: tints,
 * not fills, with `live` the one exception because the room needs to see it.
 * Colour is never the only signal; the word is always in the pill.
 */
const PILL: Record<string, string> = {
  // events
  draft: 'bg-ink-100 text-ink-700',
  published: 'bg-sky-500/12 text-sky-500',
  live: 'bg-gold-500 text-cut-950',
  closed: 'bg-green-600/12 text-green-600',
  archived: 'bg-ink-100 text-ink-500',
  // invitations
  pending: 'bg-ink-100 text-ink-700',
  accepted: 'bg-green-600/12 text-green-600',
  declined: 'bg-red-700/10 text-red-700',
  waitlisted: 'bg-gold-500/15 text-gold-600',
  cancelled: 'bg-ink-100 text-ink-500',
  // lots
  upcoming: 'bg-ink-100 text-ink-700',
  open: 'bg-gold-500 text-cut-950',
  unsold: 'bg-ink-100 text-ink-500',
  withdrawn: 'bg-ink-100 text-ink-500',
};

export function StatusPill({
  status,
  className,
  children,
}: {
  status: string;
  className?: string;
  /** A label to show instead of the raw status word. */
  children?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.6875rem] font-bold tracking-[0.1em] uppercase',
        PILL[status] ?? PILL.draft,
        className,
      )}
    >
      {status === 'live' || status === 'open' ? <span className="live-dot bg-cut-950" /> : null}
      {children ?? status}
    </span>
  );
}

/** Calendar-leaf date block: big day numeral over a month abbreviation. */
export function DateBlock({
  date,
  onDark = false,
  className,
}: {
  date: string | Date;
  onDark?: boolean;
  className?: string;
}) {
  const d = new Date(date);
  const day = new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    day: 'numeric',
  }).format(d);
  const month = new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    month: 'short',
  }).format(d);

  return (
    <div
      className={cn(
        'flex w-16 shrink-0 flex-col items-center justify-center rounded-xl py-2',
        onDark ? 'bg-white/10 text-white' : 'bg-cut-100 text-cut-900',
        className,
      )}
    >
      <span className="numeral text-[1.75rem]">{day}</span>
      <span
        className={cn(
          'mt-0.5 text-[0.6875rem] font-bold tracking-[0.12em] uppercase',
          onDark ? 'text-gold-500' : 'text-cut-700',
        )}
      >
        {month}
      </span>
    </div>
  );
}

/** Tall action card with icon, title and one line. Used in "At the door". */
export function ActionCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="card card-hover group flex items-center gap-4 p-4">
      <span className="bg-cut-900 group-hover:bg-cut-700 flex size-11 shrink-0 items-center justify-center rounded-xl text-white transition-colors">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="text-ink-900 block font-semibold">{title}</span>
        <span className="text-ink-500 block text-sm">{description}</span>
      </span>
    </Link>
  );
}
