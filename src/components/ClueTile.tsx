'use client';

import React from 'react';

export type ClueTileProps = {
  text: string;
  variant?: 'default' | 'muted' | 'highlight';
  uppercase?: boolean;
  className?: string;
  onClick?: () => void;
};



export default function ClueTile({
  text,
  uppercase = true,
  className = '',
  onClick,
}: ClueTileProps) {
  const base =
    'h-[60px] w-full flex items-center justify-center border rounded-none ' +
    'font-sans font-bold text-[40px] leading-none tracking-tight select-none ' +
    'shadow-sm focus:outline-none focus:ring-2 focus:ring-black/20 '+
    'bg-[grey] text-[white] tracking-widest';

  const classes = [
    base,
    onClick ? 'cursor-pointer hover:brightness-95 active:scale-[0.99] transition' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick();
            }
          : undefined
      }
      className={classes}
    >
      {uppercase ? text.toUpperCase() : text}
    </div>
  );
}
