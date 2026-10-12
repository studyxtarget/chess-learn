"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "./Icon";

// The five primary tabs from the reference app. "Games" is our game-review
// surface (/analyze); Play, Traps and Repertoire stay in the top navigation.
const items: { href: string; label: string; icon: IconName }[] = [
  { href: "/openings", label: "Openings", icon: "book" },
  { href: "/foundations", label: "Foundations", icon: "pawn" },
  { href: "/endgames", label: "Endgames", icon: "crown" },
  { href: "/analyze", label: "Games", icon: "search" },
  { href: "/puzzles", label: "Puzzles", icon: "target" },
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
