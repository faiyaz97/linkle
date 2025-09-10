'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

export type AnswerTileProps = {
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  bumpKey?: number;                 // per-letter bump while typing
  celebrateKey?: number;            // increment to trigger win animation
  className?: string;
  variant?: 'neutral' | 'success' | 'error';
};

const BASE_PX = 40;
const MIN_PX = 16;
const H_PAD_PX = 32; // px-4 => 16 + 16

export default function AnswerTile({
  value,
  placeholder = 'Answer',
  disabled,
  bumpKey,
  celebrateKey,
  className = '',
  variant = 'neutral',
}: AnswerTileProps) {
  const safeValue = typeof value === 'string' ? value : '';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const [fontPx, setFontPx] = useState(BASE_PX);
  const [bumpIndex, setBumpIndex] = useState<number | null>(null);
  const [containerW, setContainerW] = useState<number>(0);

  // track container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const setW = () => setContainerW(el.clientWidth);
    setW();
    const obs = new ResizeObserver(setW);
    obs.observe(el);
    window.addEventListener('resize', setW);
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', setW);
    };
  }, []);

  // per-letter bump while typing
  useEffect(() => {
    if (!safeValue) return;
    setBumpIndex(safeValue.length - 1);
    const t = setTimeout(() => setBumpIndex(null), 140);
    return () => clearTimeout(t);
  }, [bumpKey, safeValue]);

  // auto-fit font size
  useEffect(() => {
    const el = containerRef.current;
    const m = measureRef.current;
    if (!el || !m) return;

    if (!safeValue) {
      setFontPx(BASE_PX);
      return;
    }

    const available = Math.max(0, el.clientWidth - H_PAD_PX);
    let lo = MIN_PX, hi = BASE_PX, best = MIN_PX;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      m.style.fontSize = `${mid}px`;
      const w = m.offsetWidth;
      if (w <= available) { best = mid; lo = mid + 1; }
      else { hi = mid - 1; }
    }
    setFontPx(best);
  }, [safeValue, containerW]);

  const letters = useMemo(() => Array.from(safeValue), [safeValue]);

  const palette =
    variant === 'success'
      ? 'bg-[#22c55e] text-white'          // friendly green
      : variant === 'error'
      ? 'bg-[#ef4444] text-white'          // friendly red
      : 'bg-[lightgrey] text-black';

  const base =
    'h-[80px] w-full border rounded-none shadow-sm ' +
    'font-sans font-bold leading-none tracking-tight ' +
    'flex items-center justify-center px-4 select-none overflow-hidden ' +
    palette;

  // tile glow on win
  const glowStyle =
    variant === 'success' && typeof celebrateKey === 'number'
      ? { animation: 'win-glow 700ms ease-out both' as const }
      : undefined;

  return (
    <div
      aria-label="Answer"
      role="textbox"
      aria-disabled={disabled ? 'true' : 'false'}
      ref={containerRef}
      className={[base, disabled ? 'opacity-70' : '', className].join(' ')}
      style={glowStyle}
    >
      {letters.length === 0 ? (
        <span className={variant === 'neutral' ? 'text-black/40' : 'text-white/80'} style={{ fontSize: BASE_PX }}>
          {placeholder}
        </span>
      ) : (
        <div className="whitespace-nowrap text-center" style={{ fontSize: fontPx }}>
          {letters.map((ch, i) => {
            // letter wave on win, small bump on type otherwise
            const isWin = variant === 'success' && typeof celebrateKey === 'number';
            const style = isWin
              ? { animation: 'win-bounce 480ms ease-out both', animationDelay: `${i * 50}ms` }
              : { transform: i === bumpIndex ? 'scale(1.1)' : 'scale(1)' };
            return (
              <span
                key={i}
                className="inline-block transition-transform duration-150"
                style={style as React.CSSProperties}
              >
                {String(ch).toUpperCase()}
              </span>
            );
          })}
        </div>
      )}

      {/* hidden measurer */}
      <span
        ref={measureRef}
        className="absolute -z-10 opacity-0 pointer-events-none whitespace-nowrap font-sans font-bold leading-none tracking-tight"
        style={{ fontSize: fontPx }}
      >
        {safeValue.toUpperCase()}
      </span>
    </div>
  );
}
