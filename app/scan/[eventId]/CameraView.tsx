'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff } from 'lucide-react';

/**
 * The camera — DESIGN-SYSTEM §5.3.
 *
 * `html5-qrcode` is imported inside an effect rather than at module scope:
 * BUILD-SPEC §11b, it touches `navigator` and `document` on import and would
 * break the server render. It also needs HTTPS and a user gesture on iOS
 * Safari, which is why the camera starts on a button press rather than on
 * mount, and why a refusal is explained rather than swallowed — a dead camera
 * at the door is recoverable by name search, but only if the usher is told.
 */

const REGION_ID = 'cut-scanner-region';

export function CameraView({
  onDecode,
  paused,
}: {
  onDecode: (text: string) => void;
  paused: boolean;
}) {
  const [state, setState] = useState<'idle' | 'starting' | 'running' | 'denied' | 'unavailable'>(
    'idle',
  );
  const [message, setMessage] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the library ships loose types
  const scannerRef = useRef<any>(null);
  const onDecodeRef = useRef(onDecode);
  onDecodeRef.current = onDecode;

  // Stop the camera when the tab is left or the page is closed. A phone that
  // keeps a camera stream open behind a switched tab drains a battery that has
  // to last the evening.
  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (scanner) {
        scanner.stop().catch(() => {});
        scanner.clear?.();
        scannerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const scanner = scannerRef.current;
    if (!scanner || state !== 'running') return;
    // `paused` is set while a result card is on screen, so the same code is not
    // read forty times in two seconds.
    if (paused) scanner.pause?.(true);
    else scanner.resume?.();
  }, [paused, state]);

  async function start() {
    setState('starting');
    setMessage(null);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode(REGION_ID, { verbose: false });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          // A square box, sized to the viewport, so a pass held at arm's length
          // across a table fills enough of the frame to decode.
          qrbox: (viewWidth: number, viewHeight: number) => {
            const edge = Math.floor(Math.min(viewWidth, viewHeight) * 0.72);
            return { width: edge, height: edge };
          },
          aspectRatio: 1,
        },
        (decoded: string) => onDecodeRef.current(decoded),
        () => {
          // Per-frame "no code in view". Not an error; not worth a callback.
        },
      );

      setState('running');
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      const denied = /permission|denied|NotAllowed/i.test(text);
      setState(denied ? 'denied' : 'unavailable');
      setMessage(
        denied
          ? 'The camera was not allowed. Grant permission in the browser, or use Search to check the guest in by name.'
          : 'This browser will not open the camera here. A camera needs HTTPS, and only localhost is exempt. Use Search in the meantime.',
      );
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
      <div id={REGION_ID} className="h-full w-full [&_video]:h-full [&_video]:object-cover" />

      {state === 'running' ? (
        <Viewfinder />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center">
          {state === 'denied' || state === 'unavailable' ? (
            <CameraOff className="text-gold-500 size-10" aria-hidden />
          ) : (
            <Camera className="text-gold-500 size-10" aria-hidden />
          )}

          <p className="max-w-sm text-[0.9375rem] leading-relaxed text-white/80">
            {message ?? 'The camera opens when you are ready. Point it at a guest’s pass.'}
          </p>

          <button
            type="button"
            onClick={start}
            disabled={state === 'starting'}
            className="bg-gold-500 text-cut-950 hover:bg-gold-600 h-14 rounded-xl px-8 text-base font-semibold transition-colors disabled:opacity-60"
          >
            {state === 'starting'
              ? 'Opening…'
              : state === 'idle'
                ? 'Start the camera'
                : 'Try again'}
          </button>
        </div>
      )}
    </div>
  );
}

/** A 260 px square with gold corners, per DESIGN-SYSTEM §5.3. */
function Viewfinder() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="relative size-[260px] max-h-[72vw] max-w-[72vw]">
        {(
          [
            'left-0 top-0 border-l-4 border-t-4 rounded-tl-xl',
            'right-0 top-0 border-r-4 border-t-4 rounded-tr-xl',
            'left-0 bottom-0 border-l-4 border-b-4 rounded-bl-xl',
            'right-0 bottom-0 border-r-4 border-b-4 rounded-br-xl',
          ] as const
        ).map((corner) => (
          <span key={corner} className={`border-gold-500 absolute size-10 ${corner}`} />
        ))}
      </div>
    </div>
  );
}
