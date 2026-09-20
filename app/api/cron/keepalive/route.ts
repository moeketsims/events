import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { optionalEnv } from '@/lib/env';

/**
 * Keeps the free Supabase project awake. BUILD-SPEC §7.5.
 *
 * A free project pauses after seven idle days and takes a minute or so to
 * restore, which is the difference between a demo that loads and one that does
 * not. `.github/workflows/keepalive.yml` calls this weekly.
 *
 * It reads one row through the admin client rather than just returning 200:
 * the point is to touch the *database*, not this app.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const expected = optionalEnv('CRON_SECRET');

  if (!expected) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET is not set' }, { status: 503 });
  }

  const authorization = request.headers.get('authorization');
  if (authorization !== `Bearer ${expected}`) {
    // Deliberately terse: an unauthenticated caller learns nothing.
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const admin = createAdminClient();
    const { error } = await admin.from('departments').select('id').limit(1);
    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      database: 'awake',
      ms: Date.now() - startedAt,
      at: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'unknown error',
        ms: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}
