"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "./Icon";

const items: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/play", label: "Play", icon: "play" },
  { href: "/analyze", label: "Analyze", icon: "search" },
  { href: "/openings", label: "Openings", icon: "book" },
  { href: "/traps", label: "Traps", icon: "target" },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="tabbar" aria-label="Primary">
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={path === it.href ? "tab active" : "tab"}>
          <Icon name={it.icon} size={20} />
          <span>{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}
