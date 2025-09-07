'use client';

import React from 'react';

export type AnswerTileProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  variant?: 'default' | 'muted' | 'highlight';
  uppercase?: boolean; // visual transform only
  className?: string;
};


export default function AnswerTile({
  value,
  onChange,
  placeholder = '',
  disabled,
  uppercase = true,
  className = '',
}: AnswerTileProps) {
  const base =
    'h-[80px] w-full border rounded-none shadow-sm focus-within:ring-2 focus-within:ring-black/20 ' +
    'font-sans font-bold text-[40px] leading-none tracking-tight ' +
    'flex items-center ' +
    'bg-[lightgrey] text-[BLACK]'; 


  const classes = [
    base, 
    className
  ].filter(Boolean).join(' ');

  return (
    <label className={classes}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={[
          'w-full h-full bg-transparent outline-none border-0',
          'px-4',
          uppercase ? 'uppercase' : '',
          'placeholder:text-black/40',
        ].join(' ')}
      />
    </label>
  );
}
