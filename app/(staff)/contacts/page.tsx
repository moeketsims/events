import { PageHeader, StaffShell } from '@/components/staff/StaffShell';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Contacts' };

export default async function ContactsPage() {
  const profile = await requireStaff(['organiser', 'finance']);
  const supabase = await createClient();

  const { data: contacts, count } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, phone_e164, tags, alumni_year', { count: 'exact' })
    .order('last_name', { ascending: true })
    .limit(50);

  return (
    <StaffShell profile={profile}>
      <PageHeader
        title="Contacts"
        breadcrumb={profile.departmentName ?? 'Department'}
        description={`${count ?? 0} in your department. Search, filtering and CSV import land in T2.1.`}
      />

      {(contacts ?? []).length === 0 ? (
        <div className="border-hairline-strong rounded-xl border border-dashed bg-white/60 p-10 text-center">
          <p className="text-ink-900 font-semibold">No contacts yet</p>
          <p className="text-ink-500 mt-1 text-sm">
            Run <code className="font-mono">pnpm seed</code> to load the 40 fictitious demo guests.
          </p>
        </div>
      ) : (
        <div className="card table-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-hairline bg-cut-50 border-b">
              <tr>
                <th className="label-caps text-ink-500 px-4 py-3 text-left">Name</th>
                <th className="label-caps text-ink-500 px-4 py-3 text-left">Email</th>
                <th className="label-caps text-ink-500 px-4 py-3 text-left">Phone</th>
                <th className="label-caps text-ink-500 px-4 py-3 text-left">Tags</th>
              </tr>
            </thead>
            <tbody>
              {(contacts ?? []).map((c) => (
                <tr key={c.id} className="border-hairline border-b last:border-0">
                  <td className="px-4 py-3">
                    {c.first_name} {c.last_name}
                  </td>
                  <td className="text-ink-700 px-4 py-3">{c.email ?? '—'}</td>
                  <td className="text-ink-700 px-4 py-3">{c.phone_e164 ?? '—'}</td>
                  <td className="text-ink-500 px-4 py-3">{c.tags.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </StaffShell>
  );
}
