// src/components/Strikes.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Heart } from 'lucide-react';

type Props = {
  lives: number;                 // 0..3 (not used for layout)
  missed: string[];              // wrong guesses in order (max 3)
  animateIndex?: number | null;  // which slot should animate on latest miss
  animKey?: number;              // bump to retrigger animation
  className?: string;
};

/** Single-line autoshrink with binary search. */
function FitText({
  text,
  maxPx = 12,
  minPx = 4,
}: {
  text: string;
  maxPx?: number;
  minPx?: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const [px, setPx] = useState(maxPx);

  const measure = (size: number, w: number) => {
    const probe = probeRef.current!;
    probe.style.fontSize = `${size}px`;
    probe.textContent = text.toUpperCase();
    return probe.offsetWidth <= w;
  };

  const recalc = () => {
    const box = boxRef.current, probe = probeRef.current;
    if (!box || !probe) return;
    const avail = Math.max(0, box.clientWidth - 4); // small tolerance
    let lo = minPx, hi = maxPx, best = minPx;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (measure(mid, avail)) { best = mid; lo = mid + 1; }
      else { hi = mid - 1; }
    }
    setPx(best);
  };

  useEffect(() => { recalc(); const id = requestAnimationFrame(recalc); return () => cancelAnimationFrame(id); }, [text, maxPx, minPx]);
  useEffect(() => {
    const box = boxRef.current; if (!box) return;
    const ro = new ResizeObserver(recalc); ro.observe(box); return () => ro.disconnect();
  }, []);

  return (
    <div ref={boxRef} className="w-full flex justify-center min-w-0">
      <span
        className="inline-block uppercase font-bold tracking-wide whitespace-nowrap text-red-600   text-center"
        style={{ fontSize: px }}
      >
        {text}
      </span>
      <span ref={probeRef} className="absolute opacity-0 pointer-events-none whitespace-nowrap" />
    </div>
  );
}

export default function Strikes({
  lives,
  missed,
  animateIndex = null,
  animKey = 0,
  className = '',
}: Props) {
  const slots = [0, 1, 2];

  return (
    <div className={['grid grid-cols-3 gap-2', className].join(' ')}>
      {slots.map((i) => {
        const hasWord = i < missed.length;
        const play = animateIndex === i;
        const word = hasWord ? missed[i] : '';

        return (
          <div key={i} className="relative h-6 rounded-md border-none bg-red-100 select-none overflow-hidden">
            {/* Centered heart when empty */}
            {!hasWord && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Heart className="h-4 w-4 text-red-600" fill="currentColor" stroke="currentColor" />
              </div>
            )}

            {/* Centered word when missed */}
            {hasWord && (
              <div
                className={[
                  'absolute inset-0 flex items-center justify-center',
                  play ? 'animate-word-pop' : '',
                ].join(' ')}
                style={{ animationIterationCount: 1 }}
                data-key={animKey}
              >
                <div className="min-w-0 w-full flex items-center justify-center">
                  <FitText text={word}/>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
