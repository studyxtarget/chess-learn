"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { asset } from "@/lib/data";

const links = [
  { href: "/", label: "Home" },
  { href: "/play", label: "Play vs Bot" },
  { href: "/puzzles", label: "Puzzles" },
  { href: "/analyze", label: "Analyze" },
  { href: "/openings", label: "Openings" },
  { href: "/traps", label: "Traps" },
  { href: "/repertoire", label: "Repertoire" },
];

function isActive(path: string, href: string): boolean {
  const p = path.replace(/\/+$/, "") || "/";
  return p === href;
}

export default function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  // Escape closes the mobile menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link href="/" className="brand" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo-img" src={asset("/pieces/cburnett/wn.svg")} alt="" aria-hidden="true" />
          <span className="brand-txt">
            Chess <b>Learn</b>
          </span>
        </Link>

        <nav id="site-nav" className={`nav-links${open ? " open" : ""}`}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={isActive(path, l.href) ? "active" : ""}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="nav-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="site-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "✕" : "☰"}
        </button>
      </div>
    </header>
  );
}
