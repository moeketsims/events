import { cn } from '@/lib/utils';

/**
 * A ballroom painted in light — DESIGN-SYSTEM §2.5. No photograph: rows of
 * candle bokeh receding in perspective (small and sharp at the back, large and
 * soft in the foreground), a chandelier of twinkling points, two slow stage
 * beams, and a warm floor glow. Every element is a positioned div with a radial
 * gradient, so the scene renders on the server and costs nothing to ship.
 *
 * Positions come from a seeded generator so server and client markup agree.
 */

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

type Light = {
  left: number; // %
  top: number; // %
  size: number; // px
  blur: number; // px
  opacity: number;
  hue: 'gold' | 'warm' | 'pale';
  duration: number; // s
  delay: number; // s
};

function row(seed: number, count: number, y: [number, number], size: [number, number], blur: number, op: [number, number]): Light[] {
  const rand = lcg(seed);
  const hues: Light['hue'][] = ['gold', 'gold', 'warm', 'pale'];
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 0.5) / count;
    const jitter = (rand() - 0.5) * (1 / count) * 1.6;
    return {
      left: Math.min(98, Math.max(2, (t + jitter) * 100)),
      top: y[0] + rand() * (y[1] - y[0]),
      size: size[0] + rand() * (size[1] - size[0]),
      blur,
      opacity: op[0] + rand() * (op[1] - op[0]),
      hue: hues[Math.floor(rand() * hues.length)] ?? 'gold',
      duration: 3 + rand() * 4,
      delay: -rand() * 6,
    };
  });
}

// Back row: many, small, dim, nearly sharp. Mid: fewer, warmer. Front: few, huge, out of focus.
const BACK = row(11, 26, [48, 54], [5, 9], 1.5, [0.28, 0.55]);
const MID = row(23, 14, [58, 66], [14, 24], 6, [0.22, 0.42]);
const FRONT = row(37, 7, [72, 90], [48, 96], 22, [0.12, 0.24]);

const CHANDELIER = (() => {
  const rand = lcg(53);
  return Array.from({ length: 46 }, () => {
    // Cluster in an ellipse around (56%, 22%).
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand());
    return {
      left: 56 + Math.cos(a) * r * 9,
      top: 22 + Math.sin(a) * r * 7,
      size: 1.5 + rand() * 2.2,
      opacity: 0.35 + rand() * 0.6,
      duration: 1.8 + rand() * 3.4,
      delay: -rand() * 5,
    };
  });
})();

const HUE: Record<Light['hue'], string> = {
  gold: 'radial-gradient(circle, #ffe9b0 0%, #fbb927 28%, rgba(251,185,39,0.35) 55%, rgba(251,185,39,0) 72%)',
  warm: 'radial-gradient(circle, #ffd9a0 0%, #f6a623 30%, rgba(246,166,35,0.3) 55%, rgba(246,166,35,0) 72%)',
  pale: 'radial-gradient(circle, #fff6e0 0%, #ffd66b 26%, rgba(255,214,107,0.3) 55%, rgba(255,214,107,0) 72%)',
};

function Lights({ lights, className }: { lights: Light[]; className?: string }) {
  return (
    <div className={cn('absolute inset-0', className)}>
      {lights.map((l, i) => (
        <span
          key={i}
          className="candle absolute rounded-full"
          style={
            {
              left: `${l.left}%`,
              top: `${l.top}%`,
              width: l.size,
              height: l.size,
              marginLeft: -l.size / 2,
              marginTop: -l.size / 2,
              background: HUE[l.hue],
              filter: `blur(${l.blur}px)`,
              '--c-opacity': l.opacity,
              '--c-duration': `${l.duration}s`,
              '--c-delay': `${l.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function Ballroom({ intensity = 1 }: { intensity?: number }) {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden" style={{ opacity: intensity }}>
      {/* Stage beams from above, swaying very slowly. */}
      <div className="beam px-far" style={{ left: '18%', animationDelay: '-6s' }} />
      <div className="beam px-far" style={{ left: '62%', animationDuration: '31s', animationDirection: 'alternate-reverse' }} />

      {/* Chandelier: halo + points. */}
      <div
        className="px-far absolute"
        style={{
          left: '56%',
          top: '22%',
          width: 520,
          height: 360,
          marginLeft: -260,
          marginTop: -180,
          background:
            'radial-gradient(ellipse at center, rgba(255,226,160,0.22) 0%, rgba(251,185,39,0.10) 35%, rgba(251,185,39,0) 70%)',
        }}
      />
      <div className="px-far absolute inset-0">
        {CHANDELIER.map((p, i) => (
          <span
            key={i}
            className="twinkle absolute rounded-full bg-[#fff3cf]"
            style={
              {
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: p.size,
                height: p.size,
                boxShadow: '0 0 6px 1px rgba(255,226,160,0.9)',
                '--t-opacity': p.opacity,
                '--t-duration': `${p.duration}s`,
                '--t-delay': `${p.delay}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* Horizon haze where the far tables dissolve. */}
      <div
        className="px-far absolute inset-x-0"
        style={{
          top: '44%',
          height: '18%',
          background:
            'linear-gradient(180deg, rgba(251,185,39,0) 0%, rgba(251,185,39,0.07) 50%, rgba(251,185,39,0) 100%)',
        }}
      />

      {/* Three depths of candlelight. */}
      <Lights lights={BACK} className="px-far" />
      <Lights lights={MID} className="px-mid" />
      <Lights lights={FRONT} className="px-near" />

      {/* Floor glow and reflection. */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: '34%',
          background:
            'linear-gradient(0deg, rgba(251,185,39,0.16) 0%, rgba(251,185,39,0.05) 45%, rgba(251,185,39,0) 100%)',
        }}
      />
    </div>
  );
}
