"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/rules", label: "Rules" },
  { href: "/play", label: "Moon Tracker" },
  { href: "/win", label: "Declare Win" },
  { href: "/challenge", label: "Challenge" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/60 to-transparent backdrop-blur-sm">
      <Link href="/" className="text-xl font-bold tracking-tight text-amber-200 hover:text-amber-100 transition-colors">
        🌕 Moon I Win
      </Link>
      <div className="hidden sm:flex items-center gap-6">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`text-sm font-medium transition-colors ${
              pathname === href
                ? "text-amber-300"
                : "text-white/60 hover:text-white"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
      <Link
        href="/challenge"
        className="sm:hidden text-sm font-semibold bg-amber-400/20 border border-amber-400/30 text-amber-300 px-3 py-1.5 rounded-full hover:bg-amber-400/30 transition-colors"
      >
        Challenge
      </Link>
    </nav>
  );
}
