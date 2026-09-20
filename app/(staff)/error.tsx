'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Error boundary for every staff surface. Its main job is to render
 * ForbiddenError as a 403 rather than bouncing the user back to /login, so a
 * door-staff member who opens an organiser page is told they lack the role
 * instead of being asked to sign in again as themselves.
 */
export default function StaffError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const forbidden = error.message.startsWith('Requires one of:');

  return (
    <div className="bg-cut-50 flex min-h-dvh items-center justify-center px-4">
      <div className="card w-full max-w-md p-8 text-center">
        <p className="label-caps text-ink-500">
          {forbidden ? 'Error 403' : 'Something went wrong'}
        </p>
        <h1 className="text-cut-900 mt-1">
          {forbidden ? 'You do not have access to this page' : 'That did not work'}
        </h1>
        <p className="measure text-ink-700 mx-auto mt-3">
          {forbidden
            ? 'Your role does not include this part of the console. Ask a platform admin in Settings if you need it.'
            : 'The page could not be loaded. Try again, and tell the developer if it keeps happening.'}
        </p>

        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to the dashboard</Link>
          </Button>
          {!forbidden ? <Button onClick={reset}>Try again</Button> : null}
        </div>
      </div>
    </div>
  );
}
