import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Atmosphere } from '@/components/brand/Atmosphere';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Page not found' };

/**
 * The branded 404. Every unknown address, whether a mistyped pass link or a
 * console page that does not exist yet, lands on the cinematic layer with a
 * way back rather than on the framework's bare default.
 */
export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden text-white">
      <Atmosphere intensity={0.6} />

      <div className="relative z-10 mx-auto flex w-full max-w-[640px] flex-1 flex-col px-6 pt-7 pb-12 sm:px-10">
        <span className="shadow-plate inline-flex self-start rounded-xl bg-white p-2.5">
          <Logo variant="horizontal" size="sm" priority />
        </span>

        <div className="glass-panel reveal mt-auto mb-auto rounded-3xl p-8 sm:p-10">
          <p className="eyebrow eyebrow-on-dark">Not on the programme</p>
          <h1 className="font-display mt-4 text-[2.75rem] leading-[0.95] font-bold tracking-tight sm:text-6xl">
            This page is not here.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-white/70">
            The address may be mistyped, or it points at a part of the platform that has not opened
            yet. If you followed a link from an invitation or a pass, the link itself is the key, so
            check it was copied whole.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="gold" size="lg" className="h-12 px-6">
              <Link href="/">
                Back to the start <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="onDark" size="lg" className="h-12 px-6">
              <Link href="/dashboard">Staff sign-in</Link>
            </Button>
          </div>
        </div>

        <p className="text-xs tracking-wide text-white/50">
          <span className="font-display text-gold-500 text-sm font-semibold">Thinking Beyond</span>
          <span className="mx-2">·</span>
          Central University of Technology, Free State
        </p>
      </div>
    </div>
  );
}
