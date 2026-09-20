import { Ballroom } from '@/components/brand/Ballroom';
import { Parallax } from '@/components/brand/Parallax';
import { cn } from '@/lib/utils';

/**
 * The cinematic backdrop for public and attendee surfaces — DESIGN-SYSTEM §2.5.
 *
 * Layers, back to front: an optional photograph darkened almost to black, the
 * navy base, two drifting aurora blobs (CUT blue and gold), the ballroom of
 * light (candle bokeh in perspective, chandelier, stage beams, floor glow), the
 * CUT watermark symbol, rising gold particles, film grain, and a vignette. The
 * scene breathes with a 40 s Ken Burns drift and answers the pointer with
 * three depths of parallax. Everything but the parallax listener is CSS.
 * `prefers-reduced-motion` freezes all of it.
 */

// Deterministic particle field so server and client markup match.
const PARTICLES = Array.from({ length: 28 }, (_, i) => {
  const seed = (i * 9301 + 49297) % 233280;
  const rand = (n: number) => ((seed * (n + 1)) % 1000) / 1000;
  return {
    left: `${Math.round(rand(1) * 100)}%`,
    size: 2 + Math.round(rand(2) * 4),
    duration: `${16 + Math.round(rand(3) * 18)}s`,
    delay: `${-Math.round(rand(4) * 30)}s`,
    drift: `${Math.round(rand(5) * 80 - 40)}px`,
    opacity: 0.25 + rand(6) * 0.55,
  };
});

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export function Atmosphere({
  image,
  intensity = 1,
  scene = true,
  className,
}: {
  /** Optional photograph, rendered very dark under the aurora. */
  image?: string;
  /** 0.6 for quieter surfaces (pass page), 1 for hero pages. */
  intensity?: number;
  /** The ballroom of light. Off for compact headers. */
  scene?: boolean;
  className?: string;
}) {
  return (
    <Parallax
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      <div
        aria-hidden
        className="kenburns absolute inset-0"
        style={{ background: 'linear-gradient(180deg, #001738 0%, #000d24 100%)' }}
      >
        {image ? (
          <div
            className="px-far absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${image})`,
              opacity: 0.38 * intensity,
              filter: 'saturate(0.8) contrast(1.05)',
            }}
          />
        ) : null}

        {/* Aurora */}
        <div
          className="aurora"
          style={{
            width: '70vw',
            height: '70vw',
            left: '-20vw',
            top: '-30vw',
            background: 'radial-gradient(circle, rgba(0,130,209,0.55) 0%, rgba(0,130,209,0) 65%)',
            opacity: 0.5 * intensity,
          }}
        />
        <div
          className="aurora"
          style={{
            width: '60vw',
            height: '60vw',
            right: '-25vw',
            bottom: '-30vw',
            background: 'radial-gradient(circle, rgba(251,185,39,0.35) 0%, rgba(251,185,39,0) 65%)',
            opacity: 0.45 * intensity,
            animationDuration: '34s',
            animationDirection: 'alternate-reverse',
          }}
        />

        {scene ? <Ballroom intensity={intensity} /> : null}

        {/* Watermark symbol */}
        <div
          className="px-mid absolute"
          style={{
            right: '-8vw',
            top: '50%',
            width: '46vw',
            height: '60vw',
            marginTop: '-30vw',
            backgroundImage: 'url(/brand/watermark.png)',
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'contain',
            backgroundPosition: 'top right',
            opacity: 0.05 * intensity,
            filter: 'brightness(3)',
            maskImage: 'linear-gradient(180deg, #000 0%, #000 55%, transparent 62%)',
            WebkitMaskImage: 'linear-gradient(180deg, #000 0%, #000 55%, transparent 62%)',
          }}
        />

        {/* Particles */}
        <div className="px-near absolute inset-0">
          {PARTICLES.map((p, i) => (
            <span
              key={i}
              className="particle"
              style={
                {
                  left: p.left,
                  width: p.size,
                  height: p.size,
                  '--p-duration': p.duration,
                  '--p-delay': p.delay,
                  '--p-drift': p.drift,
                  '--p-opacity': p.opacity * intensity,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      </div>

      {/* Grain and vignette sit outside the Ken Burns layer so they never scale. */}
      <div
        aria-hidden
        className="absolute inset-0 mix-blend-overlay"
        style={{ backgroundImage: GRAIN, opacity: 0.35 }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 40%, rgba(0,0,0,0) 40%, rgba(0,13,36,0.78) 100%)',
        }}
      />
    </Parallax>
  );
}
