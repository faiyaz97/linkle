// src/components/Keyboard.tsx
'use client';

import { Delete } from 'lucide-react';
import React from 'react';

export type KeyState = 'idle' | 'miss' | 'present' | 'correct'; // kept for API compat, ignored
type Props = {
  onKey: (ch: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  states?: Partial<Record<string, KeyState>>; // ignored so all keys look the same
  className?: string;
};

const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

export default function Keyboard({
  onKey,
  onBackspace,
  onEnter,
  className = '',
}: Props) {
  // Fluid sizes using clamp(): small on phones, comfortable on desktop
  const keyBase =
    'rounded-md font-bold shadow-sm transition bg-gray-300 text-black ' +
    'hover:bg-gray-400 active:bg-gray-500 focus:outline-none touch-manipulation select-none';

  // Normal key
  const keyClass =
    keyBase +
    ' w-[clamp(34px,7.2vw,56px)] h-[clamp(40px,7.6vw,60px)] text-[clamp(12px,2.8vw,16px)]';

  // Wider keys for Enter/Backspace
  const wideKeyClass =
    keyBase +
    ' w-[clamp(64px,12vw,96px)] h-[clamp(40px,7.6vw,60px)] text-[clamp(12px,2.8vw,16px)] px-2';

  return (
    <div className={['select-none', className].join(' ')}>
      {/* Row 1 */}
      <div className="flex justify-center gap-2 mb-2">
        {rows[0].split('').map((ch) => (
          <button
            key={ch}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onKey(ch)}
            className={keyClass}
            aria-label={`Key ${ch}`}
          >
            {ch}
          </button>
        ))}
      </div>

      {/* Row 2 */}
      <div className="flex justify-center gap-2 mb-2">
        {rows[1].split('').map((ch) => (
          <button
            key={ch}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onKey(ch)}
            className={keyClass}
            aria-label={`Key ${ch}`}
          >
            {ch}
          </button>
        ))}
      </div>

      {/* Row 3 with ENTER and BACKSPACE */}
      <div className="flex justify-center gap-2">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onEnter}
          className={wideKeyClass}
          aria-label="Enter"
        >
          ENTER
        </button>

        {rows[2].split('').map((ch) => (
          <button
            key={ch}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onKey(ch)}
            className={keyClass}
            aria-label={`Key ${ch}`}
          >
            {ch}
          </button>
        ))}

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onBackspace}
          className={wideKeyClass}
          aria-label="Backspace"
        >
        <Delete className="w-7 h-7 m-auto" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
