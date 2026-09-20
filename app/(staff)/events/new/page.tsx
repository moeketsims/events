import { PageHeader, StaffShell } from '@/components/staff/StaffShell';
import { requireStaff } from '@/lib/auth/staff';
import { NewEventForm } from './NewEventForm';

export const metadata = { title: 'New event' };

export default async function NewEventPage() {
  // Organisers only. A door-staff session reaching this page raises
  // ForbiddenError, which app/(staff)/error.tsx renders as a 403.
  const profile = await requireStaff(['organiser']);

  return (
    <StaffShell profile={profile}>
      <PageHeader
        title="Create an event"
        breadcrumb="Events"
        description="The essentials now; venue, banner, questions and the auction come after it exists."
      />
      <div className="border-ink-300 max-w-2xl rounded-lg border bg-white p-6">
        <NewEventForm />
      </div>
    </StaffShell>
  );
}
