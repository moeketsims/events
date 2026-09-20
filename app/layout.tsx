import type { Metadata, Viewport } from 'next';
import { Barlow_Condensed, Source_Sans_3 } from 'next/font/google';
import { APP_URL } from '@/lib/env';
import './globals.css';

// Open substitutes for CUT's licensed Univers Condensed and Myriad Pro.
// DESIGN-SYSTEM §3.
const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-barlow-condensed',
  display: 'swap',
});

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-source-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'CUT Events',
    template: '%s · CUT Events',
  },
  description:
    'Invitations, RSVP, QR check-in, live broadcasts and silent auctions for Central University of Technology, Free State.',
  applicationName: 'CUT Events',
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'CUT Events',
    description:
      'Invitations, RSVP, QR check-in, live broadcasts and silent auctions for Central University of Technology, Free State.',
    siteName: 'CUT Events',
    locale: 'en_ZA',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'CUT Events' }],
  },
  // Attendee links must never be indexed: they carry pass tokens.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#003261',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA" className={`${barlowCondensed.variable} ${sourceSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
