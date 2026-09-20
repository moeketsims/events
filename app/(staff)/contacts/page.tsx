import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Search, Users } from 'lucide-react';
import { PageHeader, StaffShell } from '@/components/staff/StaffShell';
import { Button } from '@/components/ui/button';
import { hasRole, requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { ImportDialog } from './ImportDialog';

export const metadata = { title: 'Contacts' };

const PAGE_SIZE = 50;

/**
 * Supabase's `or()` filter takes a comma-separated expression list, so a comma,
 * a parenthesis or a quote in the search box would be read as syntax rather
 * than as text. Strip them: nobody searches a guest list for a bracket.
 */
function sanitiseQuery(raw: string): string {
  return raw
    .replace(/[,()"'*\\%]/g, ' ')
    .trim()
    .slice(0, 80);
}

type SearchParams = { q?: string; tag?: string; page?: string };

/** `/contacts?q=…&tag=…&page=…`, leaving out anything at its default. */
function pageHref(params: SearchParams): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.tag) sp.set('tag', params.tag);
  if (params.page && params.page !== '1') sp.set('page', params.page);
  const query = sp.toString();
  return query ? `/contacts?${query}` : '/contacts';
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const profile = await requireStaff(['organiser', 'finance']);
  const params = await searchParams;

  const q = sanitiseQuery(params.q ?? '');
  const tag = (params.tag ?? '').trim().toLowerCase().slice(0, 40);
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  let query = supabase
    .from('contacts')
    .select(
      'id, first_name, last_name, email, phone_e164, organisation, title, tags, alumni_year',
      { count: 'exact' },
    )
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  if (q) {
    query = query.or(
      [
        `first_name.ilike.%${q}%`,
        `last_name.ilike.%${q}%`,
        `email.ilike.%${q}%`,
        `organisation.ilike.%${q}%`,
      ].join(','),
    );
  }
  if (tag) query = query.contains('tags', [tag]);

  const { data: contacts, count } = await query;

  // PostgREST answers a range past the end of the result set with 416 and no
  // count, so an out-of-range page arrives here as "zero contacts" rather than
  // as "page nine of four". Ask for the count alone and send the visitor to the
  // last real page; without this, a stale bookmark shows an empty department.
  if ((contacts ?? []).length === 0 && page > 1) {
    let countOnly = supabase.from('contacts').select('id', { count: 'exact', head: true });
    if (q) {
      countOnly = countOnly.or(
        [
          `first_name.ilike.%${q}%`,
          `last_name.ilike.%${q}%`,
          `email.ilike.%${q}%`,
          `organisation.ilike.%${q}%`,
        ].join(','),
      );
    }
    if (tag) countOnly = countOnly.contains('tags', [tag]);

    const { count: realCount } = await countOnly;
    if ((realCount ?? 0) > 0) {
      const last = Math.max(1, Math.ceil((realCount ?? 0) / PAGE_SIZE));
      if (page > last) redirect(pageHref({ q, tag, page: String(last) }));
    }
  }

  // The tag filter offers what the department actually uses. A separate read
  // rather than a view: the POC's lists are small, and a `select distinct
  // unnest(tags)` needs a function to be reachable through PostgREST.
  const { data: tagRows } = await supabase.from('contacts').select('tags').limit(2000);
  const tagCounts = new Map<string, number>();
  for (const row of tagRows ?? []) {
    for (const t of row.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const tags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canImport = hasRole(profile, ['organiser']);

  const href = (next: Partial<SearchParams>) => pageHref({ q, tag, page: String(page), ...next });

  const filtered = Boolean(q || tag);

  return (
    <StaffShell profile={profile}>
      <PageHeader
        title="Contacts"
        breadcrumb={profile.departmentName ?? 'Department'}
        description={
          filtered
            ? `${total} of your department's contacts match this filter.`
            : `${total} alumni, donors, staff and partners in your department.`
        }
        action={canImport ? <ImportDialog /> : null}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <form action="/contacts" className="relative min-w-0 flex-1 sm:max-w-sm">
          {tag ? <input type="hidden" name="tag" value={tag} /> : null}
          <Search
            className="text-ink-500 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Name, email or organisation"
            aria-label="Search contacts"
            className="border-hairline-strong focus:border-cut-700 focus:ring-cut-700/20 h-11 w-full rounded-md border bg-white pr-3 pl-9 text-sm focus:ring-4 focus:outline-none"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={href({ tag: '', page: '1' })}
            aria-current={tag ? undefined : 'page'}
            className={
              tag
                ? 'border-hairline-strong text-ink-700 hover:border-cut-700 hover:text-cut-900 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors'
                : 'bg-cut-900 rounded-full px-3 py-1.5 text-xs font-semibold text-white'
            }
          >
            All
          </Link>
          {tags.map(([name, n]) => (
            <Link
              key={name}
              href={href({ tag: name === tag ? '' : name, page: '1' })}
              aria-current={name === tag ? 'page' : undefined}
              className={
                name === tag
                  ? 'bg-cut-900 rounded-full px-3 py-1.5 text-xs font-semibold text-white'
                  : 'border-hairline-strong text-ink-700 hover:border-cut-700 hover:text-cut-900 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors'
              }
            >
              {name}
              <span className={name === tag ? 'ml-1.5 text-white/60' : 'text-ink-500 ml-1.5'}>
                {n}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {(contacts ?? []).length === 0 ? (
        <div className="border-hairline-strong rounded-xl border border-dashed p-12 text-center">
          <Users className="text-cut-700/40 mx-auto size-10" aria-hidden />
          <p className="text-ink-900 mt-4 font-semibold">
            {filtered ? 'Nothing matches that' : 'No contacts yet'}
          </p>
          <p className="text-ink-500 mx-auto mt-1 max-w-sm text-sm">
            {filtered ? (
              <>
                Try a shorter search, or{' '}
                <Link href="/contacts" className="text-cut-700 underline">
                  clear the filter
                </Link>
                .
              </>
            ) : canImport ? (
              <>
                Import a CSV, or run <code className="font-mono">pnpm seed</code> to load the 40
                fictitious demo guests.
              </>
            ) : (
              'Nothing has been imported into your department yet.'
            )}
          </p>
        </div>
      ) : (
        <>
          <div className="card table-card overflow-hidden">
            <table>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Tags</th>
                  <th scope="col" className="text-right">
                    Class of
                  </th>
                </tr>
              </thead>
              <tbody>
                {(contacts ?? []).map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="text-ink-900 font-semibold">
                        {c.first_name} {c.last_name}
                      </span>
                      {c.organisation || c.title ? (
                        <span className="text-ink-500 block text-xs">
                          {[c.title, c.organisation].filter(Boolean).join(' · ')}
                        </span>
                      ) : null}
                    </td>
                    <td className="text-ink-700">{c.email ?? '—'}</td>
                    <td className="text-ink-700 font-mono text-xs">{c.phone_e164 ?? '—'}</td>
                    <td>
                      {(c.tags ?? []).length === 0 ? (
                        <span className="text-ink-300">—</span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {c.tags.map((t) => (
                            <span
                              key={t}
                              className="bg-cut-100 text-cut-900 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold"
                            >
                              {t}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="tabular text-ink-700 text-right">{c.alumni_year ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {lastPage > 1 ? (
            <nav
              aria-label="Contacts pages"
              className="text-ink-500 mt-5 flex items-center justify-between text-sm"
            >
              <span>
                {from + 1}–{Math.min(from + PAGE_SIZE, total)} of {total}
              </span>
              <span className="flex gap-2">
                <Button
                  asChild={page > 1}
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  aria-disabled={page === 1}
                >
                  {page > 1 ? (
                    <Link href={href({ page: String(page - 1) })}>Previous</Link>
                  ) : (
                    <span>Previous</span>
                  )}
                </Button>
                <Button
                  asChild={page < lastPage}
                  variant="outline"
                  size="sm"
                  disabled={page === lastPage}
                  aria-disabled={page === lastPage}
                >
                  {page < lastPage ? (
                    <Link href={href({ page: String(page + 1) })}>Next</Link>
                  ) : (
                    <span>Next</span>
                  )}
                </Button>
              </span>
            </nav>
          ) : null}
        </>
      )}
    </StaffShell>
  );
}
