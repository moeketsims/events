'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// From lib/auth/roles, not lib/auth/staff: staff.ts is server-only and pulling
// it into a client bundle is a build error.
import { ROLES, ROLE_LABELS, type UserRole } from '@/lib/auth/roles';
import { inviteStaff, setUserRole, type SettingsState } from './actions';

function Feedback({ state }: { state: SettingsState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-md bg-red-700/10 p-3 text-sm text-red-700">
        {state.error}
      </p>
    );
  }
  if (!state.notice) return null;
  return (
    <div role="status" className="rounded-md bg-green-600/10 p-3 text-sm text-green-600">
      <p className="font-semibold">{state.notice}</p>
      {state.magicLink ? (
        <p className="text-ink-700 mt-2 font-mono text-xs break-all">{state.magicLink}</p>
      ) : null}
    </div>
  );
}

function Pending({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : children}
    </Button>
  );
}

export function RoleForm({
  userId,
  currentRole,
  disabled,
}: {
  userId: string;
  currentRole: UserRole;
  disabled: boolean;
}) {
  const [state, action] = useActionState<SettingsState, FormData>(setUserRole, {});

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <label className="sr-only" htmlFor={`role-${userId}`}>
        Role
      </label>
      <select
        id={`role-${userId}`}
        name="role"
        defaultValue={currentRole}
        disabled={disabled}
        className="border-hairline-strong disabled:bg-ink-100 disabled:text-ink-500 h-11 rounded-md border bg-white px-3 text-sm"
      >
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </select>
      {disabled ? <span className="text-ink-500 text-sm">You</span> : <Pending>Save</Pending>}
      {state.error ? <span className="text-sm text-red-700">{state.error}</span> : null}
    </form>
  );
}

export function InviteForm() {
  const [state, action] = useActionState<SettingsState, FormData>(inviteStaff, {});

  return (
    <form action={action} className="space-y-4">
      <Feedback state={state} />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="invite-name">Full name</Label>
          <Input id="invite-name" name="fullName" required placeholder="Naledi Mokoena" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-email">Email address</Label>
          <Input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="naledi@cut.ac.za"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-role">Role</Label>
          <select
            id="invite-role"
            name="role"
            defaultValue="door_staff"
            className="border-hairline-strong h-9 w-full rounded-md border bg-white px-3 text-sm"
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Pending>Invite</Pending>
    </form>
  );
}
