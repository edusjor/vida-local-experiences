"use client";

import { useState } from "react";
import Link from "next/link";
import { siteConfig } from "../../lib/siteConfig";

const MAIN_LINKS = [
  { href: "/", label: "Home" },
  { href: "/tours", label: "Tours" },
  { href: "/quienes-somos", label: "About Us" },
  { href: "/contacto", label: "Contact" },
] as const;

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {open ? (
        <>
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </>
      ) : (
        <>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </>
      )}
    </svg>
  );
}

export default function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="site-header sticky top-0 z-50">
      <div className="relative mx-auto w-full max-w-6xl px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" aria-label={siteConfig.brandName} className="inline-flex items-center">
            <img
              src={siteConfig.logoPath}
              alt={siteConfig.brandName}
              className="h-12 w-auto max-w-[210px] object-contain md:h-14 md:max-w-[260px]"
              loading="eager"
            />
          </Link>

          <nav className="hidden gap-6 text-sm font-bold uppercase tracking-[0.18em] text-white/88 md:flex">
            {MAIN_LINKS.map((item) => (
              <Link key={item.href} href={item.href} className="transition hover:text-[var(--brand-gold)]">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/tours"
              className="hidden rounded-full bg-[var(--brand-gold)] px-4 py-2 text-sm font-bold text-[#11151c] shadow-lg shadow-black/20 transition hover:brightness-105 md:inline-flex"
            >
              Explore experiences
            </Link>

            <button
              type="button"
              onClick={() => setIsOpen((value) => !value)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/10 text-slate-100 transition hover:bg-white/20 md:hidden"
              aria-label={isOpen ? "Close main menu" : "Open main menu"}
              aria-expanded={isOpen}
              aria-controls="mobile-main-menu"
            >
              <HamburgerIcon open={isOpen} />
            </button>
          </div>
        </div>

        {isOpen && (
          <nav
            id="mobile-main-menu"
            className="absolute left-4 right-4 top-[calc(100%-0.25rem)] z-50 grid gap-2 rounded-2xl border border-white/10 bg-[#151922]/98 p-3 text-sm font-bold uppercase tracking-[0.18em] text-slate-100 shadow-2xl shadow-black/30 backdrop-blur-sm md:hidden"
          >
            {MAIN_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 transition hover:bg-white/10"
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/tours"
              className="mt-1 rounded-lg bg-[var(--brand-gold)] px-3 py-2 text-center font-extrabold text-[#11151c] transition hover:brightness-105"
              onClick={() => setIsOpen(false)}
            >
              Explore experiences
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}