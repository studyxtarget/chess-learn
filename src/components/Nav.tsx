"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { asset } from "@/lib/data";

const links = [
  { href: "/", label: "Home" },
  { href: "/play", label: "Play vs Bot" },
  { href: "/analyze", label: "Analyze" },
  { href: "/openings", label: "Openings" },
  { href: "/traps", label: "Traps" },
  { href: "/repertoire", label: "Repertoire" },
];

export default function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

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

        <nav className={`nav-links${open ? " open" : ""}`}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={path === l.href ? "active" : ""}
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
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "✕" : "☰"}
        </button>
      </div>
    </header>
  );
}
