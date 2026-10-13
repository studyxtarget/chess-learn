"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import MiniBoard from "@/components/MiniBoard";
import { bots, repertoire, traps, asset } from "@/lib/data";
import { LEVELS, levelOf, openingKey, readProgress } from "@/lib/levels";
import { DEFAULT_PROGRESS, loadProgress, type PuzzleProgress } from "@/lib/puzzleRating";

type Opening = {
  moves: string;
  name: string;
  fen: string;
  games: number;
  white: number;
  black: number;
  eco: string | null;
  ecoGroup: string | null;
};

const DAILY_KEY = "chesslearn.openingDaily";
const PROGRESS_KEY = "chesslearn.puzzleProgress";
const DAILY_GOAL = { discover: 3, master: 2, puzzles: 3 };

function today(): string {
  // Local calendar date — toISOString() is UTC, which rolled the day over at 5:30am IST.
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function stripEco(name: string): string {
  return name.replace(/^[A-E]\d{2}:\s*/, "");
}

function fmtGames(n: number): string {
  return n > 5_000_000 ? "—" : n.toLocaleString("en-IN");
}

/** A card in one of the opening strips. */
function OpeningCard({ o }: { o: Opening }) {
  return (
    <Link className="hcard" href="/openings" title={stripEco(o.name)}>
      <span className="hcard-title">{stripEco(o.name)}</span>
      <MiniBoard fen={o.fen} size={92} />
      <span className="hcard-meta">
        {o.eco ?? ""} · {fmtGames(o.games)}
      </span>
      <span className="hcard-badge" aria-hidden="true">
        {o.white >= o.black ? "W" : "B"}
      </span>
    </Link>
  );
}

export default function HomePage() {
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [learned, setLearned] = useState<Record<string, true>>({});
  const [puzzle, setPuzzle] = useState<PuzzleProgress>({ ...DEFAULT_PROGRESS });
  const [daily, setDaily] = useState({ discover: 0, master: 0 });

  useEffect(() => {
    setLearned(readProgress());
    setPuzzle(loadProgress(typeof window !== "undefined" ? localStorage.getItem(PROGRESS_KEY) : null));
    try {
      const raw = localStorage.getItem(DAILY_KEY);
      const d = raw ? JSON.parse(raw) : null;
      if (d && d.date === today()) setDaily({ discover: d.discover ?? 0, master: d.master ?? 0 });
    } catch {
      /* ignore */
    }
    fetch(asset("/data/openings.json"))
      .then((r) => r.json())
      .then((d: Opening[]) => setOpenings(d.filter((o) => o.games > 0 && o.games <= 5_000_000)))
      .catch(() => setOpenings([]));
  }, []);

  /** Most-played lines that clearly favour each side. */
  const strips = useMemo(() => {
    const top = (favours: (o: Opening) => boolean) => {
      const seen = new Set<string>();
      const out: Opening[] = [];
      for (const o of [...openings].filter(favours).sort((a, b) => b.games - a.games)) {
        const label = stripEco(o.name);
        // the data repeats some lines that would render as identical cards
        if (seen.has(label)) continue;
        seen.add(label);
        out.push(o);
        if (out.length === 12) break;
      }
      return out;
    };
    return {
      white: top((o) => o.white - o.black >= 8),
      black: top((o) => o.black - o.white >= 8),
    };
  }, [openings]);

  /** Opening-course level from how many lines have been marked learned. */
  const course = useMemo(() => {
    if (!openings.length) return { current: LEVELS[0], next: LEVELS[1], pct: 0, done: 0, total: 0 };
    const totals: Record<number, { total: number; done: number }> = {};
    for (const o of openings) {
      const n = levelOf(o.moves.split(/\s+/).filter(Boolean).length).n;
      totals[n] ||= { total: 0, done: 0 };
      totals[n].total += 1;
      if (learned[openingKey(o.name, o.moves)]) totals[n].done += 1;
    }
    let current = LEVELS[LEVELS.length - 1];
    for (const l of LEVELS) {
      const t = totals[l.n];
      if (t && t.done < t.total) {
        current = l;
        break;
      }
    }
    const i = LEVELS.findIndex((l) => l.n === current.n);
    const done = Object.keys(learned).length;
    const total = openings.length;
    return {
      current,
      next: LEVELS[i + 1] ?? null,
      pct: total ? Math.round((done / total) * 100) : 0,
      done,
      total,
    };
  }, [openings, learned]);

  const tasks = [
    { label: "Discover new lines", got: Math.min(daily.discover, DAILY_GOAL.discover), goal: DAILY_GOAL.discover },
    { label: "Master lines", got: Math.min(daily.master, DAILY_GOAL.master), goal: DAILY_GOAL.master },
    {
      label: "Solve puzzles",
      got: Math.min(puzzle.solved, DAILY_GOAL.puzzles),
      goal: DAILY_GOAL.puzzles,
    },
  ];

  const training = [
    { href: "/play", icon: "play" as const, title: "Play vs Bot", desc: `${bots.length} bots, different strengths` },
    { href: "/analyze", icon: "search" as const, title: "Analyze", desc: "Review a game move by move" },
    { href: "/traps", icon: "target" as const, title: "Traps", desc: `${traps.length} traps to punish` },
    { href: "/repertoire", icon: "doc" as const, title: "Repertoire", desc: `${repertoire.length} prepared lines` },
  ];

  return (
    <div className="home">
      <div className="container home-pad">
        {/* ---------- rank ---------- */}
        <div className="rankcard">
          <div className="rank-top">
            <div>
              <span className="lbl">Current level</span>
              <strong>{course.current.name}</strong>
            </div>
            <div className="right">
              <span className="lbl">Next level</span>
              <strong>{course.next ? course.next.name : "Complete"}</strong>
            </div>
          </div>
          <div className="ranktrack">
            <span className="chev" aria-hidden="true">‹</span>
            {LEVELS.map((l) => {
              const active = l.n === course.current.n;
              return (
                <span key={l.n} className={`node ${active ? "cur" : ""}`} title={l.name}>
                  {l.n}
                </span>
              );
            })}
            <span className="chev" aria-hidden="true">›</span>
          </div>
          <div className="lvl-bar">
            <span style={{ width: `${course.pct}%` }} />
          </div>
          <div className="muted small" style={{ marginTop: 8 }}>
            {course.done} of {course.total || "…"} opening lines learned · puzzle rating{" "}
            {puzzle.rating}
          </div>
        </div>

        {/* ---------- today's workout ---------- */}
        <div className="workout">
          <div className="workout-head">
            <strong>Today&apos;s workout</strong>
            <span className="checker" aria-hidden="true" />
          </div>
          {tasks.map((t) => (
            <div className="workout-row" key={t.label}>
              <span className={`wbox ${t.got >= t.goal ? "tick" : ""}`} aria-hidden="true">
                {t.got >= t.goal ? "✓" : ""}
              </span>
              <span className="wlabel">{t.label}</span>
              <span className="wbar">
                <span style={{ width: `${Math.round((t.got / t.goal) * 100)}%` }} />
              </span>
              <span className="wcount">
                {t.got}/{t.goal}
              </span>
            </div>
          ))}
          <div className="workout-foot">
            Focus: {course.current.name} — {course.current.blurb}
          </div>
        </div>

        {/* ---------- white openings ---------- */}
        <section className="home-sec">
          <div className="sec-head">
            <h2>White openings</h2>
            <Link className="viewall" href="/openings">
              View all <Icon name="chevron" size={13} />
            </Link>
          </div>
          {strips.white.length ? (
            <div className="hstrip">
              {strips.white.map((o, i) => (
                <OpeningCard key={`${o.name}-${i}`} o={o} />
              ))}
            </div>
          ) : (
            <p className="muted small">
              <span className="spinner" /> Loading lines…
            </p>
          )}
        </section>

        {/* ---------- black openings ---------- */}
        <section className="home-sec">
          <div className="sec-head">
            <h2>Black openings</h2>
            <Link className="viewall" href="/openings">
              View all <Icon name="chevron" size={13} />
            </Link>
          </div>
          {strips.black.length ? (
            <div className="hstrip">
              {strips.black.map((o, i) => (
                <OpeningCard key={`${o.name}-${i}`} o={o} />
              ))}
            </div>
          ) : (
            <p className="muted small">
              <span className="spinner" /> Loading lines…
            </p>
          )}
        </section>

        {/* ---------- training ---------- */}
        <section className="home-sec">
          <div className="sec-head">
            <h2>Training</h2>
          </div>
          <div className="menu-grid">
            {training.map((a) => (
              <Link key={a.href} href={a.href} className="menu-card">
                <span className="menu-ic">
                  <Icon name={a.icon} size={18} />
                </span>
                <span className="menu-body">
                  <span className="menu-tt">{a.title}</span>
                  <span className="menu-dd">{a.desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ---------- at a glance ---------- */}
        <section className="home-sec">
          <div className="sec-head">
            <h2>At a glance</h2>
            <Link className="viewall" href="/openings">
              View all <Icon name="chevron" size={13} />
            </Link>
          </div>
          <div className="stat-row">
            <div className="stat-card">
              <span className="stat-ic orange">
                <Icon name="book" size={17} />
              </span>
              <div className="stat-num">{openings.length ? openings.length.toLocaleString("en-IN") : "—"}</div>
              <div className="stat-lbl">Openings</div>
            </div>
            <div className="stat-card">
              <span className="stat-ic red">
                <Icon name="target" size={17} />
              </span>
              <div className="stat-num">{traps.length}</div>
              <div className="stat-lbl">Traps</div>
            </div>
            <div className="stat-card">
              <span className="stat-ic green">
                <Icon name="play" size={17} />
              </span>
              <div className="stat-num">{bots.length}</div>
              <div className="stat-lbl">Bots</div>
            </div>
            <div className="stat-card">
              <span className="stat-ic purple">
                <Icon name="doc" size={17} />
              </span>
              <div className="stat-num">{puzzle.solved}</div>
              <div className="stat-lbl">Solved</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
