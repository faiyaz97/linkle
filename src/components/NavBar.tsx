// src/components/NavBar.tsx
'use client';

import Link from 'next/link';
import React from 'react';

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
      className="p-2 rounded-md text-white/90 hover:text-white hover:bg-white/10 transition"
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
          {/* Account */}
          <IconButton href="/account" label="Account">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="black" role="img" aria-hidden="true">
              <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5Zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5Z"/>
            </svg>
          </IconButton>

          {/* Settings */}
          <IconButton href="/settings" label="Settings">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="black" role="img" aria-hidden="true">
              <path d="M19.14 12.936c.041-.304.06-.616.06-.936s-.019-.632-.06-.936l2.037-1.59a.5.5 0 0 0 .12-.648l-1.93-3.342a.5.5 0 0 0-.607-.223l-2.4.966a7.26 7.26 0 0 0-1.62-.936l-.36-2.55a.5.5 0 0 0-.495-.423h-3.86a.5.5 0 0 0-.495.423l-.36 2.55a7.26 7.26 0 0 0-1.62.936l-2.4-.966a.5.5 0 0 0-.607.223L2.7 8.826a.5.5 0 0 0 .12.648l2.037 1.59c-.041.304-.06.616-.06.936s.019.632.06.936l-2.037 1.59a.5.5 0 0 0-.12.648l1.93 3.342a.5.5 0 0 0 .607.223l2.4-.966c.498.39 1.044.71 1.62.936l.36 2.55a.5.5 0 0 0 .495.423h3.86a.5.5 0 0 0 .495-.423l.36-2.55c.576-.226 1.122-.546 1.62-.936l2.4.966a.5.5 0 0 0 .607-.223l1.93-3.342a.5.5 0 0 0-.12-.648l-2.037-1.59ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"/>
            </svg>
          </IconButton>

          {/* Help */}
          <IconButton href="/help" label="Help">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="black" role="img" aria-hidden="true">
              <path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2Zm0 15a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm1.2-3.85v.6h-2.4v-.9c0-1.32 1.02-1.86 1.71-2.23.6-.32.99-.53.99-1.12 0-.62-.53-1.1-1.5-1.1-.93 0-1.53.44-1.74 1.25l-2.25-.69C8.43 6.38 9.86 5.1 12.02 5.1c2.3 0 3.98 1.32 3.98 3.29 0 1.76-1.36 2.39-2.2 2.86-.55.31-1 .56-1 .9Z"/>
            </svg>
          </IconButton>

          {/* Leaderboard */}
          <IconButton href="/leaderboard" label="Leaderboard">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="black" role="img" aria-hidden="true">
              <path d="M8 13H5a2 2 0 0 0-2 2v5h5v-7Zm11-2h-3v9h5v-7a2 2 0 0 0-2-2ZM14 3h-4a2 2 0 0 0-2 2v17h8V5a2 2 0 0 0-2-2Z"/>
            </svg>
          </IconButton>
        </nav>
      </div>
    </header>
  );
}
