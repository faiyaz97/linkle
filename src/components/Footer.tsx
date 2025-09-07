// src/components/Footer.tsx
'use client';

type FooterProps = {
  idx?: number;
  localDate?: string;
  tz: string;
  className?: string;
};

export default function Footer({ idx, localDate, tz, className = '' }: FooterProps) {
  return (
    <footer className="p-4">
        <p className="text-xs text-black/60">
          Puzzle: {idx ?? 0} • Local: {localDate ?? '-'} • TZ: {tz}
        </p>
    </footer>
  );
}
