import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { BrandFooter } from '@/components/brand/BrandFrame';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="bg-cut-50 flex min-h-dvh flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg text-center">
          <Logo variant="vertical" size="md" priority className="mb-8" />

          <h1 className="font-display text-cut-900 text-4xl font-bold">CUT Events</h1>
          <p className="measure text-ink-700 mx-auto mt-3">
            Invitations, RSVP, QR check-in, live broadcasts and silent auctions for Institutional
            Advancement and every department of the university.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/login">Staff sign in</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/scan">Door scanner</Link>
            </Button>
          </div>

          <p className="text-ink-500 mt-8 text-sm">
            Guests do not sign in. Your invitation link is your RSVP, and your pass link is your
            entry.
          </p>
        </div>
      </div>

      <BrandFooter />
    </div>
  );
}
