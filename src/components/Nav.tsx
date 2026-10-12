"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { asset } from "@/lib/data";
import { applyBoardTheme, getStoredThemeId } from "@/lib/theme";
import SettingsPanel from "@/components/SettingsPanel";

const links = [
  { href: "/", label: "Home" },
  { href: "/play", label: "Play vs Bot" },
  { href: "/puzzles", label: "Puzzles" },
  { href: "/analyze", label: "Analyze" },
  { href: "/openings", label: "Openings" },
  { href: "/foundations", label: "Foundations" },
  { href: "/endgames", label: "Endgames" },
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
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Escape closes the mobile menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Apply the saved board theme globally on load (harmless on board-less pages).
  useEffect(() => {
    applyBoardTheme(getStoredThemeId());
  }, []);

  return (
    <>
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
          className="nav-gear"
          aria-label="Open settings"
          aria-haspopup="dialog"
          onClick={() => { setOpen(false); setSettingsOpen(true); }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
              stroke="currentColor"
              strokeWidth="1.7"
            />
            <path
              d="M19.4 13a7.9 7.9 0 0 0 0-2l2-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-1.7-1l-.4-2.5H11l-.4 2.5c-.6.2-1.2.6-1.7 1l-2.3-.9-2 3.4L6.6 11a7.9 7.9 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9c.5.4 1.1.8 1.7 1l.4 2.5h4l.4-2.5c.6-.2 1.2-.6 1.7-1l2.3.9 2-3.4-2-1.5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </button>

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

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
