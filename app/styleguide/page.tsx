import { notFound } from 'next/navigation';
import { Logo } from '@/components/brand/Logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatZAR } from '@/lib/money';

export const metadata = { title: 'Style guide' };

/**
 * Development-only reference for DESIGN-SYSTEM §2–§5. Not reachable in
 * production; it exists so a token change can be eyeballed in one place.
 */

const BRAND = [
  ['cut-950', '#001738', 'Projection background'],
  ['cut-900', '#003261', 'CUT Blue — primary'],
  ['cut-800', '#004072', ''],
  ['cut-700', '#004B88', 'Hover, links'],
  ['cut-600', '#255C91', ''],
  ['cut-100', '#E6EEF6', 'Tinted surfaces'],
  ['cut-50', '#F3F7FB', ''],
] as const;

const ACCENT = [
  ['gold-500', '#FBB927', 'Leading bid, live'],
  ['gold-600', '#E0A31E', 'Closing soon'],
  ['sky-500', '#0082D1', 'Informational'],
  ['green-600', '#289728', 'Success, checked in'],
  ['red-700', '#A12830', 'Error, outbid'],
] as const;

const NEUTRAL = [
  ['ink-900', '#111827', ''],
  ['ink-700', '#374151', ''],
  ['ink-500', '#6B7280', ''],
  ['ink-300', '#D1D5DB', 'Borders'],
  ['ink-100', '#F3F4F6', ''],
  ['paper', '#FFFFFF', ''],
] as const;

function Swatch({ name, hex, note }: { name: string; hex: string; note: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="border-ink-300 size-12 shrink-0 rounded-md border"
        style={{ backgroundColor: hex }}
      />
      <div className="min-w-0">
        <div className="text-ink-900 font-mono text-sm">{name}</div>
        <div className="text-ink-500 font-mono text-xs">{hex}</div>
        {note ? <div className="text-ink-500 text-xs">{note}</div> : null}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="border-ink-300 font-display text-cut-900 mb-4 border-b pb-2">{title}</h2>
      {children}
    </section>
  );
}

export default function StyleguidePage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-10">
        <p className="label-caps text-ink-500">CUT Events</p>
        <h1 className="text-cut-900">Style guide</h1>
        <p className="measure text-ink-700 mt-2">
          Everything in DESIGN-SYSTEM §2–§5 rendered from the live tokens. If a value here is wrong,
          fix <code className="font-mono text-sm">app/globals.css</code>, not the component.
        </p>
      </header>

      <Section title="Colour">
        <div className="grid gap-8 sm:grid-cols-3">
          <div className="space-y-3">
            <h3 className="label-caps text-ink-500">Brand</h3>
            {BRAND.map(([n, h, d]) => (
              <Swatch key={n} name={n} hex={h} note={d} />
            ))}
          </div>
          <div className="space-y-3">
            <h3 className="label-caps text-ink-500">Accent (≤ 30 %)</h3>
            {ACCENT.map(([n, h, d]) => (
              <Swatch key={n} name={n} hex={h} note={d} />
            ))}
          </div>
          <div className="space-y-3">
            <h3 className="label-caps text-ink-500">Neutral</h3>
            {NEUTRAL.map(([n, h, d]) => (
              <Swatch key={n} name={n} hex={h} note={d} />
            ))}
          </div>
        </div>
        <p className="bg-cut-50 text-ink-700 mt-6 rounded-md p-4 text-sm">
          Logo maroon <code className="font-mono">#881010</code> and logo gold{' '}
          <code className="font-mono">#F8B000</code> belong to the mark alone and are never UI
          colours. Never put <span className="font-semibold">gold-500</span> text on white.
        </p>
      </Section>

      <Section title="Typography">
        <div className="space-y-4">
          <div>
            <span className="label-caps text-ink-500">Display 160 / Barlow Condensed 700</span>
            <div className="tabular font-display text-cut-900 text-[160px] leading-none font-bold">
              R2 500
            </div>
          </div>
          <div>
            <span className="label-caps text-ink-500">H1 36 / Barlow Condensed 700</span>
            <h1 className="text-cut-900">CUT Fundraising Gala Dinner</h1>
          </div>
          <div>
            <span className="label-caps text-ink-500">H2 28 / Barlow Condensed 600</span>
            <h2>Silent auction</h2>
          </div>
          <div>
            <span className="label-caps text-ink-500">H3 18 / Source Sans 3 600</span>
            <h3>Lot 2 — Signed Cheetahs rugby jersey</h3>
          </div>
          <div>
            <span className="label-caps text-ink-500">Body 16 / Source Sans 3 400</span>
            <p className="measure">
              You are checked in. Welcome, Naledi. Your bidder number is 014 — it is on your pass
              and it is the only thing the room will see when you bid.
            </p>
          </div>
          <div>
            <span className="label-caps text-ink-500">Small 14</span>
            <p className="text-ink-500 text-sm">Friday 30 October 2026, 18:00 · CUT Hotel School</p>
          </div>
          <div>
            <span className="label-caps text-ink-500">Amounts — tabular</span>
            <p className="tabular font-semibold">
              {formatZAR(2500)} · {formatZAR(12750)} · {formatZAR(999)} · {formatZAR(1500.5)}
            </p>
          </div>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Send invitations</Button>
          <Button variant="secondary">Preview</Button>
          <Button variant="outline">Export CSV</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">Void bid</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="mt-4 max-w-[480px]">
          <span className="label-caps text-ink-500">Attendee bid button — 56 px, full width</span>
          <Button className="mt-2 h-14 w-full text-lg">Bid {formatZAR(2750)}</Button>
        </div>
      </Section>

      <Section title="Badges and status pills">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-ink-500">Draft</Badge>
          <Badge className="bg-sky-500">Published</Badge>
          <Badge className="bg-gold-500 text-ink-900">
            <span className="bg-ink-900 mr-1 inline-block size-2 animate-pulse rounded-full" />
            Live
          </Badge>
          <Badge className="bg-green-600">Closed</Badge>
          <Badge className="bg-ink-300 text-ink-700">Archived</Badge>
          <Badge className="bg-cut-900">Bidder 042</Badge>
          <Badge className="bg-gold-500 text-ink-900">You are leading</Badge>
          <Badge className="bg-red-700">Outbid</Badge>
          <Badge className="bg-green-600">Checked in</Badge>
        </div>
      </Section>

      <Section title="Cards and form controls">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Lot 1</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-ink-500 text-sm">Weekend for two at a Clarens guesthouse</p>
              <p className="tabular text-cut-900 text-2xl font-semibold">{formatZAR(3500)}</p>
              <p className="text-ink-500 text-sm">Next min {formatZAR(3750)} · closes in 6:12</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Input</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="sg-email">Email address</Label>
                <Input id="sg-email" type="email" placeholder="you@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sg-amount">Your amount</Label>
                <Input id="sg-amount" inputMode="numeric" defaultValue="2750" className="tabular" />
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Logo — light backgrounds">
        <div className="border-ink-300 flex flex-wrap items-end gap-8 rounded-md border bg-white p-8">
          <div>
            <Logo variant="horizontal" size="sm" />
            <p className="text-ink-500 mt-2 text-xs">horizontal · sm · 160 px (minimum)</p>
          </div>
          <div>
            <Logo variant="horizontal" size="md" />
            <p className="text-ink-500 mt-2 text-xs">horizontal · md · 220 px</p>
          </div>
          <div>
            <Logo variant="vertical" size="sm" />
            <p className="text-ink-500 mt-2 text-xs">vertical · sm · 120 px (minimum)</p>
          </div>
        </div>
      </Section>

      <Section title="Logo — dark backgrounds need the white plate">
        <div className="bg-cut-900 flex flex-wrap items-end gap-8 rounded-md p-8">
          <div>
            <Logo variant="horizontal" size="sm" plate />
            <p className="text-cut-100 mt-2 text-xs">horizontal · sm · plate</p>
          </div>
          <div>
            <Logo variant="vertical" size="sm" plate />
            <p className="text-cut-100 mt-2 text-xs">vertical · sm · plate</p>
          </div>
          <p className="text-cut-100 max-w-xs text-sm">
            The supplied files are RGB on white with no transparency. The CI rule is explicit: a
            white block must be created for the identity to live on.
          </p>
        </div>
      </Section>

      <Section title="Projection theme (.theme-display)">
        <div className="theme-display bg-background text-foreground rounded-md p-8">
          <div className="flex items-start justify-between">
            <Logo variant="horizontal" size="sm" plate />
            <span className="text-gold-500 inline-flex items-center gap-2">
              <span className="bg-gold-500 inline-block size-3 animate-pulse rounded-full" />
              <span className="label-caps">Live</span>
            </span>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-6">
            {[
              { n: 2, t: 'Signed Cheetahs rugby jersey', bid: 1750, bidder: '014' },
              { n: 4, t: 'Executive braai set', bid: 2500, bidder: '007' },
              { n: 5, t: 'A year of Sunday lunches', bid: 6500, bidder: '021' },
            ].map((lot) => (
              <div key={lot.n} className="bg-card rounded-lg p-5">
                <p className="label-caps text-muted-foreground">Lot {lot.n}</p>
                <p className="font-display text-2xl leading-tight font-semibold">{lot.t}</p>
                <p className="tabular font-display text-gold-500 mt-3 text-5xl font-bold">
                  {formatZAR(lot.bid)}
                </p>
                <p className="text-muted-foreground mt-1 text-lg">Bidder {lot.bidder}</p>
              </div>
            ))}
          </div>
          <p className="font-display text-gold-500 mt-8 text-3xl font-semibold">Thinking Beyond</p>
        </div>
      </Section>

      <Section title="Semantic colour in context">
        <div className="space-y-2">
          <div className="rounded-md bg-green-600 p-4 text-white">
            Welcome, Naledi. You are checked in. Bidder 014.
          </div>
          <div className="rounded-md bg-sky-500 p-4 text-white">Already checked in at 18:42.</div>
          <div className="rounded-md bg-red-700 p-4 text-white">Not valid for this event.</div>
          <div className="bg-gold-500/10 text-gold-600 rounded-md p-4">
            Closing soon — 1:24 remaining.
          </div>
        </div>
      </Section>
    </div>
  );
}
