"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/play", label: "Play vs Bot" },
  { href: "/openings", label: "Openings" },
  { href: "/traps", label: "Traps" },
  { href: "/repertoire", label: "Repertoire" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link href="/" className="brand">
          <span className="logo">♞</span>
          Chessis
        </Link>
        <nav className="nav-links">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={path === l.href ? "active" : ""}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
