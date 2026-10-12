"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "./Icon";

const items: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/play", label: "Play", icon: "play" },
  { href: "/puzzles", label: "Puzzles", icon: "target" },
  { href: "/analyze", label: "Analyze", icon: "search" },
  { href: "/openings", label: "Openings", icon: "book" },
  { href: "/traps", label: "Traps", icon: "target" },
  { href: "/repertoire", label: "Repertoire", icon: "doc" },
];

function isActive(path: string, href: string): boolean {
  const p = path.replace(/\/+$/, "") || "/";
  return p === href;
}

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="tabbar" aria-label="Primary">
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={isActive(path, it.href) ? "tab active" : "tab"}>
          <Icon name={it.icon} size={20} />
          <span>{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}
