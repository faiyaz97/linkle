// src/components/NavBar.tsx
'use client';

import Link from 'next/link';
import React from 'react';
import { User, Settings, HelpCircle, Trophy, Heart } from 'lucide-react';

type NavBarProps = { title?: string };

function IconButton({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex items-center justify-center p-2 rounded-md text-black hover:bg-black/5 hover:opacity-80 transition-colors duration-150 "
    >
      {children}
    </Link>
  );
}

export default function NavBar({ title = 'LINKLE' }: NavBarProps) {
  return (
    <header className="w-full sticky top-0 z-40 border-b border-black bg-[white]">
      {/* Full-width bar. Left content pinned left, right content pinned right. */}
      <div className="w-full h-16 flex items-center">
        {/* Left: logo + title, flush-left */}
        <div className="pl-4 pr-2">
          <Link href="/" className="flex items-center gap-2 text-black">
            <span className="inline-flex h-14 w-14 items-center justify-center bg-white/90 text-[40px] text-[rgb(49,78,82)] font-extrabold ">
              L
            </span>
            <span className="text-lg font-bold tracking-wide text-[30px]">{title}</span>
          </Link>
        </div>

        {/* Right: icons, flush-right */}
        <nav className="ml-auto pr-4 flex items-center gap-1">
          {/* Leaderboard */}
          <IconButton href="/leaderboard" label="Leaderboard">
            <Trophy size={34} strokeWidth={2} />
          </IconButton>

          {/* Help */}
          <IconButton href="/help" label="Help">
            <HelpCircle size={34} strokeWidth={2} />
          </IconButton>

          {/* Settings */}
          <IconButton href="/settings" label="Settings">
            <Settings size={34} strokeWidth={2} />
          </IconButton>

          {/* User */}
          <IconButton href="/account" label="Account">
            <User size={34} strokeWidth={2} />
          </IconButton>
        </nav>
      </div>
    </header>
  );
}
