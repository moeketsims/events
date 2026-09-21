import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { Logo } from '@/components/brand/Logo';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { joinUrl } from '@/lib/auth/join';
import { PrintButton } from './PrintButton';

export const metadata = { title: 'Print the table sheet' };

/**
 * The A4 sheet that goes on the tables — docs/07 §2.5. No console chrome:
 * the logo, the event title, one instruction, the QR at 120 mm and the URL in
 * text for a phone whose camera will not read it.
 */
export default async function PrintSheetPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  await requireStaff(['organiser']);
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select('id, title, join_token')
    .eq('id', eventId)
    .maybeSingle();

  if (!event || !event.join_token) notFound();

  const url = joinUrl(event.join_token);
  const qrSvg = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    color: { dark: '#001738', light: '#FFFFFF' },
  });

  return (
    <div className="min-h-dvh bg-white text-[#001738]">
      <style>{`
        @page { size: A4; margin: 20mm; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: #fff !important; }
          .sheet { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; }
        }
      `}</style>

      <div className="no-print flex items-center justify-between gap-4 px-6 py-4">
        <p className="text-sm text-[#5B6B80]">
          One sheet per table. A4 portrait. The QR prints at 120 mm.
        </p>
        <PrintButton />
      </div>

      <main className="sheet mx-auto flex min-h-[257mm] w-[210mm] flex-col px-[20mm] py-[10mm]">
        <div className="flex items-start justify-between">
          <Logo variant="horizontal" size="md" priority />
        </div>

        <h1 className="font-display mt-[18mm] text-[38pt] leading-[1.02] font-bold tracking-tight text-balance">
          {event.title}
        </h1>
        <p className="mt-[6mm] text-[18pt] font-semibold">Scan to register and check in</p>

        <div
          className="mx-auto mt-[14mm] w-[120mm] [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
          // The SVG comes from `qrcode`, built from our own URL.
          dangerouslySetInnerHTML={{ __html: qrSvg }}
          role="img"
          aria-label="Self-registration QR code"
        />

        <p className="mx-auto mt-[8mm] max-w-[150mm] text-center font-mono text-[14pt] leading-snug break-all">
          {url}
        </p>

        <p className="mt-auto pt-[12mm] text-center text-[11pt] text-[#5B6B80]">
          Central University of Technology, Free State · Institutional Advancement
        </p>
      </main>
    </div>
  );
}
