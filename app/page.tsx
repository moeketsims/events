import Link from 'next/link';
import { ArrowRight, Gavel, Mail, QrCode, Radio } from 'lucide-react';
import { BrandPanel } from '@/components/brand/BrandPanel';
import { Button } from '@/components/ui/button';

const PILLARS = [
  {
    icon: Mail,
    title: 'Invitations and RSVP',
    copy: 'Email and WhatsApp invitations with a personal link. Replies, plus-ones and dietary needs land in one list.',
  },
  {
    icon: QrCode,
    title: 'QR check-in',
    copy: 'Every accepted guest gets a signed pass. A scan at the door is the register, time-stamped and exportable.',
  },
  {
    icon: Radio,
    title: 'Live broadcasts',
    copy: 'Messages reach only the people who have arrived, on their pass page and on WhatsApp.',
  },
  {
    icon: Gavel,
    title: 'Silent auctions',
    copy: 'Bid from a phone, watch the board move on the screen. Numbers in the room, names for the team.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-white lg:grid lg:grid-cols-[1.1fr_1fr]">
      <BrandPanel
        eyebrow="Central University of Technology, Free State"
        headline={
          <>
            Every CUT event.
            <br />
            One <span className="text-gold-500">platform</span>.
          </>
        }
        copy="From the first invitation to the last winning bid, one place for Institutional Advancement and every department of the university."
        className="min-h-[52vh] lg:min-h-dvh"
      />

      <div className="animate-fade-up flex flex-col justify-center px-6 py-14 sm:px-12 lg:px-16">
        <div className="max-w-lg">
          <p className="eyebrow">What it does</p>
          <ul className="mt-6 space-y-6">
            {PILLARS.map(({ icon: Icon, title, copy }) => (
              <li key={title} className="flex gap-4">
                <span className="bg-cut-100 text-cut-900 flex size-11 shrink-0 items-center justify-center rounded-xl">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-display text-cut-900 text-[1.375rem] leading-tight font-semibold">
                    {title}
                  </p>
                  <p className="text-ink-500 mt-1 text-[0.9375rem] leading-relaxed">{copy}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-12 px-6 text-[0.9375rem]">
              <Link href="/login">
                Staff sign in <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-6 text-[0.9375rem]">
              <Link href="/scan">Door scanner</Link>
            </Button>
          </div>

          <p className="text-ink-500 border-hairline mt-10 border-t pt-6 text-sm">
            Guests never sign in. Your invitation link is your RSVP, and your pass link is your entry.
          </p>
        </div>
      </div>
    </div>
  );
}
