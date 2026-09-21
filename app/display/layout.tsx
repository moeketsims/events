import { Atmosphere } from '@/components/brand/Atmosphere';
import { EscapeGuard } from '@/components/display/EscapeGuard';

export const metadata = {
  title: 'Projection',
  robots: { index: false, follow: false },
};

/**
 * The projection surface — DESIGN-SYSTEM §5.4, docs/06 T4.1.
 *
 * No chrome, no cursor, no scrollbars. `.theme-display` retunes the tokens for
 * a room lit by a projector; the cinematic backdrop runs at full intensity
 * under the CUT watermark, exactly as the landing page previews it.
 */
export default function DisplayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="theme-display watermark relative h-dvh w-screen overflow-hidden text-white select-none"
      style={{ cursor: 'none' }}
    >
      <Atmosphere intensity={1} />
      <EscapeGuard />
      <div className="relative z-10 flex h-full flex-col">{children}</div>
    </div>
  );
}
