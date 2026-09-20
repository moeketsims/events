import Link from 'next/link';
import { ArrowRight, Gavel, Mail, QrCode, Radio, Wallet } from 'lucide-react';
import { Atmosphere } from '@/components/brand/Atmosphere';
import { LiveStrip } from '@/components/brand/LiveStrip';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { formatBidderNumber } from '@/lib/dates';
import { formatZAR } from '@/lib/money';
import { getShowcase } from '@/lib/public/showcase';
import { cn } from '@/lib/utils';

const STEPS = [
  {
    n: '01',
    icon: Mail,
    title: 'The invitation',
    copy: 'Email and WhatsApp, each with a personal link. Replies, plus-ones and dietary needs land in one list. Reminders go out on their own.',
  },
  {
    n: '02',
    icon: QrCode,
    title: 'The door',
    copy: 'Every accepted guest carries a signed pass. One scan is the register, time-stamped and attributed. No paper, no queue.',
  },
  {
    n: '03',
    icon: Radio,
    title: 'The room',
    copy: 'A message reaches only the people who have arrived, on their pass page and on WhatsApp. Dinner is served, the auction is closing.',
  },
  {
    n: '04',
    icon: Gavel,
    title: 'The auction',
    copy: 'Guests bid from their phones. The board on the screen moves within a second, showing numbers, never names. The team sees both.',
  },
  {
    n: '05',
    icon: Wallet,
    title: 'The gift',
    copy: 'The lot closes, the winner is told, the payment link arrives. Settled before the coffee, with a Section 18A certificate on request.',
  },
];

export default async function HomePage() {
  const showcase = await getShowcase();
  const featuredLots = showcase.lots.filter((l) => l.highBid !== null).slice(0, 6);

  return (
    <div className="relative min-h-dvh overflow-hidden text-white">
      <Atmosphere />

      <div className="relative z-10 mx-auto w-full max-w-[1400px] px-6 sm:px-10 lg:px-14">
        <header className="reveal flex items-center justify-between gap-6 pt-7">
          <span className="shadow-plate inline-flex rounded-xl bg-white p-2.5">
            <Logo variant="horizontal" size="sm" priority />
          </span>
          <nav className="flex items-center gap-3">
            <Button asChild variant="onDark" className="h-10 px-4">
              <Link href="/scan">Door scanner</Link>
            </Button>
            <Button asChild variant="gold" className="h-10 px-4">
              <Link href="/login">
                Staff sign in <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </nav>
        </header>

        {/* Hero */}
        <section className="grid min-h-[calc(100dvh-7.5rem)] items-center gap-12 py-10 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
          <div>
            <p
              className="eyebrow eyebrow-on-dark reveal tracking-[0.18em]"
              style={{ '--reveal-delay': '0.1s' } as React.CSSProperties}
            >
              Central University of Technology · Institutional Advancement
            </p>
            <h1
              className="font-display reveal mt-6 text-[clamp(3rem,min(5.8vw,11vh),6.5rem)] leading-[0.92] font-bold tracking-[-0.01em] text-balance"
              style={{ '--reveal-delay': '0.2s' } as React.CSSProperties}
            >
              Where CUT gathers.
              <br />
              <span className="text-gold-metallic">Where CUT gives.</span>
            </h1>
            <p
              className="reveal mt-8 max-w-xl text-[1.125rem] leading-relaxed text-white/70 sm:text-[1.25rem]"
              style={{ '--reveal-delay': '0.32s' } as React.CSSProperties}
            >
              From the first invitation to the last gift: one place for every CUT event, and for the
              generosity that carries the university forward.
            </p>
            <div
              className="reveal mt-10 flex flex-wrap gap-3"
              style={{ '--reveal-delay': '0.42s' } as React.CSSProperties}
            >
              <Button asChild variant="gold" size="lg" className="h-13 px-7 text-base">
                <Link href="/login">
                  Enter the platform <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="onDark" size="lg" className="h-13 px-7 text-base">
                <Link href="#night">How a night unfolds</Link>
              </Button>
            </div>
          </div>

          <div className="reveal" style={{ '--reveal-delay': '0.5s' } as React.CSSProperties}>
            <LiveStrip data={showcase} />
          </div>
        </section>

        {/* The night */}
        <section id="night" className="py-20">
          <div className="hairline-gold mb-14" />
          <p className="eyebrow eyebrow-on-dark tracking-[0.18em]">How a night unfolds</p>
          <h2 className="font-display mt-5 max-w-3xl text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.95] font-bold text-balance">
            Five moments. One thread through all of them.
          </h2>

          <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-2 xl:grid-cols-5">
            {STEPS.map(({ n, icon: Icon, title, copy }) => (
              <li
                key={n}
                className="group relative bg-[#001738]/80 p-7 transition-colors duration-300 hover:bg-[#003261]/70"
              >
                <div className="flex items-center justify-between">
                  <span className="numeral text-gold-500/70 text-[2.5rem] transition-colors group-hover:text-gold-500">
                    {n}
                  </span>
                  <Icon className="size-5 text-white/40 transition-colors group-hover:text-white/80" aria-hidden />
                </div>
                <p className="font-display mt-8 text-[1.625rem] leading-none font-semibold">{title}</p>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-white/60">{copy}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* The board */}
        {featuredLots.length > 0 ? (
          <section className="py-20">
            <div className="hairline-gold mb-14" />
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="eyebrow eyebrow-on-dark tracking-[0.18em]">The board, as the room sees it</p>
                <h2 className="font-display mt-5 text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.95] font-bold">
                  Numbers in the room. <span className="text-gold-metallic">Names for the team.</span>
                </h2>
              </div>
              <p className="max-w-sm text-[0.9375rem] text-white/60">
                What the projector shows tonight. Every bidder number was assigned at the door from a
                QR scan, so the team always knows who is behind it.
              </p>
            </div>

            <ul className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {featuredLots.map((lot) => (
                <li
                  key={lot.lotNumber}
                  className={cn(
                    'glass-panel relative overflow-hidden rounded-2xl p-6 transition-transform duration-500 hover:-translate-y-1',
                  )}
                >
                  <div className="flex items-center justify-between text-[0.6875rem] font-bold tracking-[0.14em] text-white/50 uppercase">
                    <span>Lot {lot.lotNumber}</span>
                    <span className={cn(lot.status === 'open' ? 'text-gold-500' : 'text-white/40')}>
                      {lot.status === 'open' ? 'Open' : lot.status}
                    </span>
                  </div>
                  <p className="font-display mt-4 min-h-[2.4em] text-[1.5rem] leading-[1.15] font-semibold text-balance">
                    {lot.title}
                  </p>
                  <p className="numeral text-gold-metallic mt-6 text-[3rem]">{formatZAR(lot.highBid ?? 0)}</p>
                  <p className="mt-2 text-sm text-white/55">
                    Leading · Bidder {formatBidderNumber(lot.bidderNumber)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Close */}
        <section className="py-24 text-center">
          <div className="hairline-gold mx-auto mb-14 max-w-2xl" />
          <p className="font-display text-gold-500 text-xl font-semibold tracking-wide">Thinking Beyond</p>
          <h2 className="font-display mx-auto mt-5 max-w-3xl text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.95] font-bold text-balance">
            Every seat. Every bid. Every gift, accounted for.
          </h2>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button asChild variant="gold" size="lg" className="h-13 px-7 text-base">
              <Link href="/login">
                Staff sign in <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
          <p className="mt-16 text-sm text-white/45">
            Central University of Technology, Free State · Bloemfontein +27 51 507 3911 · Welkom +27
            57 910 3500 ·{' '}
            <Link href="https://www.cut.ac.za" className="text-white/70 underline underline-offset-4">
              www.cut.ac.za
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
