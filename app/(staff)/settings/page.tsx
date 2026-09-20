import { CheckCircle2, CircleDashed } from 'lucide-react';
import { PageHeader, StaffShell } from '@/components/staff/StaffShell';
import { requireStaff } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';
import { APP_URL, REALTIME_MODE, optionalEnv } from '@/lib/env';
import { InviteForm, RoleForm } from './SettingsForms';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const profile = await requireStaff(['platform_admin']);
  const admin = createAdminClient();

  const { data: users } = await admin
    .from('profiles')
    .select('id, full_name, email, role, created_at')
    .eq('department_id', profile.departmentId ?? '')
    .order('created_at', { ascending: true });

  const integrations = [
    { name: 'Supabase', ready: Boolean(optionalEnv('SUPABASE_SECRET_KEY')), detail: APP_URL },
    {
      name: 'Email',
      ready: Boolean(optionalEnv('RESEND_API_KEY') || optionalEnv('BREVO_API_KEY')),
      detail: `${process.env.EMAIL_PROVIDER ?? 'resend'} · ${optionalEnv('EMAIL_FROM') ?? 'no From address set'}`,
    },
    {
      name: 'WhatsApp',
      ready: Boolean(
        optionalEnv('WHATSAPP_ACCESS_TOKEN') && optionalEnv('WHATSAPP_PHONE_NUMBER_ID'),
      ),
      detail: 'Meta Cloud API test number',
    },
    { name: 'Yoco', ready: Boolean(optionalEnv('YOCO_SECRET_KEY')), detail: 'Sandbox' },
    {
      name: 'Pass signing',
      ready: Boolean(optionalEnv('PASS_SIGNING_SECRET')),
      detail: 'HMAC secret',
    },
    { name: 'Realtime', ready: true, detail: `${REALTIME_MODE} mode` },
  ];

  return (
    <StaffShell profile={profile}>
      <PageHeader
        title="Settings"
        breadcrumb={profile.departmentName ?? 'Department'}
        description="Staff and roles for your department, and the state of each integration."
      />

      <section className="mb-10">
        <h2 className="text-cut-900 mb-4">Staff</h2>
        <div className="border-ink-300 overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="border-ink-300 bg-ink-100 border-b">
              <tr>
                <th className="label-caps text-ink-500 px-4 py-3 text-left">Name</th>
                <th className="label-caps text-ink-500 px-4 py-3 text-left">Email</th>
                <th className="label-caps text-ink-500 px-4 py-3 text-left">Role</th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((user) => (
                <tr key={user.id} className="border-ink-300 border-b last:border-0">
                  <td className="px-4 py-3">{user.full_name ?? '—'}</td>
                  <td className="text-ink-700 px-4 py-3">{user.email}</td>
                  <td className="px-4 py-2">
                    <RoleForm
                      userId={user.id}
                      currentRole={user.role}
                      disabled={user.id === profile.id}
                    />
                  </td>
                </tr>
              ))}
              {(users ?? []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-ink-500 px-4 py-8 text-center">
                    No staff in this department yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="text-ink-500 mt-2 text-sm">
          A role change takes effect on that person&rsquo;s next request. Roles are enforced in the
          database by Row Level Security, not only in the interface.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-cut-900 mb-4">Invite a colleague</h2>
        <div className="border-ink-300 rounded-lg border bg-white p-6">
          <InviteForm />
        </div>
      </section>

      <section>
        <h2 className="text-cut-900 mb-4">Integrations</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {integrations.map((item) => (
            <li
              key={item.name}
              className="border-ink-300 flex items-start gap-3 rounded-lg border bg-white p-4"
            >
              {item.ready ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-600" aria-hidden />
              ) : (
                <CircleDashed className="text-ink-300 mt-0.5 size-5 shrink-0" aria-hidden />
              )}
              <div className="min-w-0">
                <p className="text-ink-900 font-semibold">{item.name}</p>
                <p className="text-ink-500 truncate text-sm">{item.detail}</p>
                <p className="text-ink-500 text-sm">
                  {item.ready ? 'Configured' : 'Not configured'}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-ink-500 mt-2 text-sm">
          An unconfigured provider does not block anything: the send is attempted, the delivery row
          is written with <code className="font-mono">not_configured</code>, and the rest of the
          flow carries on.
        </p>
      </section>
    </StaffShell>
  );
}
