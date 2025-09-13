'use client';

import React from 'react';
import Link from 'next/link';
import { User, Settings, HelpCircle, Trophy } from 'lucide-react';

type NavBarProps = { title?: string; onOpenLeaderboard?: () => void };

function IconButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { children, ...rest } = props;
  return (
    <button
      {...rest}
      className="inline-flex items-center justify-center p-2 rounded-md text-black hover:bg-black/5 hover:opacity-80 transition-colors duration-150"
    >
      {children}
    </button>
  );
}

export default function NavBar({ title = 'LINKLE', onOpenLeaderboard }: NavBarProps) {
  return (
    <header className="w-full sticky top-0 z-40 border-b border-black bg-white">
      <div className="w-full h-16 flex items-center">
        {/* Left: logo + title */}
        <div className="pl-4 pr-2">
          <Link href="/" className="flex items-center gap-2 text-black">
            <span className="inline-flex h-14 w-14 items-center justify-center bg-white text-[40px] text-[rgb(49,78,82)] font-extrabold">
              L
            </span>
            <span className="text-[30px] font-bold tracking-wide">{title}</span>
          </Link>
        </div>

        {/* Right: icons */}
        <nav className="ml-auto pr-4 flex items-center gap-1 text-black">
          <Link
            href="/account"
            aria-label="Account"
            className="inline-flex items-center justify-center p-2 rounded-md text-black hover:bg-black/5 hover:opacity-80 transition-colors duration-150"
          >
            <User className="w-7 h-7" strokeWidth={2} />
          </Link>

          <Link
            href="/settings"
            aria-label="Settings"
            className="inline-flex items-center justify-center p-2 rounded-md text-black hover:bg-black/5 hover:opacity-80 transition-colors duration-150"
          >
            <Settings className="w-7 h-7" strokeWidth={2} />
          </Link>

          <Link
            href="/help"
            aria-label="Help"
            className="inline-flex items-center justify-center p-2 rounded-md text-black hover:bg-black/5 hover:opacity-80 transition-colors duration-150"
          >
            <HelpCircle className="w-7 h-7" strokeWidth={2} />
          </Link>

          <IconButton
            aria-label="Leaderboard"
            onClick={() => onOpenLeaderboard && onOpenLeaderboard()}
            title="Leaderboard"
          >
            <Trophy className="w-7 h-7" strokeWidth={2} />
          </IconButton>
        </nav>
      </div>
    </header>
  );
}
