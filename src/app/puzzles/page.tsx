"use client";

import { Chess } from "chess.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board from "@/components/Board";
import MiniBoard from "@/components/MiniBoard";
import {
  DEFAULT_PROGRESS,
  loadProgress,
  nextRating,
  pickPuzzle,
  type PuzzleProgress,
} from "@/lib/puzzleRating";

type Puzzle = { t: string; r: number; f: string; m: string[] };

const BANDS: { label: string; lo: number; hi: number }[] = [
  { label: "1200–1400", lo: 1200, hi: 1400 },
  { label: "1600–1800", lo: 1600, hi: 1800 },
  { label: "2000–2200", lo: 2000, hi: 2200 },
];

const PROGRESS_KEY = "chesslearn.puzzleProgress";
const THEMES_KEY = "chesslearn.puzzleThemes";
/** Dropdown value that selects the adaptive (rating-driven) mode. */
const ADAPTIVE = "adaptive";

/** Rating ladder — each rank starts where the previous one ends. */
const RANKS: { name: string; min: number }[] = [
  { name: "Beginner", min: 800 },
  { name: "Novice", min: 1000 },
  { name: "Apprentice", min: 1200 },
  { name: "Intermediate", min: 1400 },
  { name: "Advanced", min: 1600 },
  { name: "Expert", min: 1900 },
];

/** "advanced_pawn" -> "Advanced pawn" — theme ids are snake_case in the data. */
function prettyTheme(t: string): string {
  const s = t.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function rankOf(rating: number) {
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (rating >= RANKS[k].min) i = k;
  return { index: i, current: RANKS[i], next: RANKS[i + 1] ?? null };
}

function readThemeCounts(): Record<string, number> {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(THEMES_KEY) : null;
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function fenAfter(startFen: string, moves: string[], n: number): string {
  const g = new Chess(startFen);
  for (let i = 0; i < n && i < moves.length; i++) {
    const u = moves[i];
    try {
      g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
    } catch {
      break;
    }
  }
  return g.fen();
}

export default function PuzzlesPage() {
  const [all, setAll] = useState<Puzzle[]>([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState("all");
  // Default to the adaptive mode; the three bands remain a manual override.
  const [mode, setMode] = useState<string>(ADAPTIVE);
  const [cur, setCur] = useState<Puzzle | null>(null);
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState("Find the best move.");
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const revealRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wrongRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [progress, setProgress] = useState<PuzzleProgress>({ ...DEFAULT_PROGRESS });
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [themeCounts, setThemeCounts] = useState<Record<string, number>>({});
  /** "types" shows the theme grid; "solve" shows the board. */
  const [view, setView] = useState<"types" | "solve">("types");

  const themes = useMemo(() => Array.from(new Set(all.map((p) => p.t))).sort(), [all]);

  /** First puzzle of each theme — its start position is the card thumbnail. */
  const themeCards = useMemo(() => {
    const first: Record<string, Puzzle> = {};
    const total: Record<string, number> = {};
    for (const p of all) {
      if (!first[p.t]) first[p.t] = p;
      total[p.t] = (total[p.t] ?? 0) + 1;
    }
    return themes.map((t) => ({ theme: t, fen: first[t]?.f ?? "", total: total[t] ?? 0 }));
  }, [all, themes]);

  useEffect(() => {
    setProgress(loadProgress(typeof window !== "undefined" ? localStorage.getItem(PROGRESS_KEY) : null));
    setThemeCounts(readThemeCounts());
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/data/puzzles.json`)
      .then((r) => r.json())
      .then((d: { items: Puzzle[] }) => {
        // Drop any puzzle whose solution does not replay cleanly (bad FEN rights etc.)
        const valid = d.items.filter((pz) => {
          try {
            const g = new Chess(pz.f);
            for (const u of pz.m) {
              g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
            }
            return true;
          } catch {
            return false;
          }
        });
        setAll(valid);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const pool = useMemo(
    () =>
      all.filter((p) => {
        if (theme !== "all" && p.t !== theme) return false;
        // In adaptive mode the rating band is ignored — the picker uses the user's rating.
        if (mode !== ADAPTIVE) {
          const b = BANDS.find((x) => x.label === mode);
          if (b && (p.r < b.lo || p.r >= b.hi)) return false;
        }
        return true;
      }),
    [all, theme, mode],
  );

  const next = useCallback(() => {
    if (revealRef.current) { clearInterval(revealRef.current); revealRef.current = null; }
    if (wrongRef.current) { clearTimeout(wrongRef.current); wrongRef.current = null; }
    setRevealing(false);
    if (pool.length === 0) return;
    let pick: Puzzle | null;
    if (mode === ADAPTIVE) {
      // Nearest-to-your-rating draw (preferring unseen puzzles).
      pick = pickPuzzle(pool, progress.rating, seen) ?? pool[0];
    } else {
      const unseen = pool.filter((p) => !seen.has(p.f));
      const src = unseen.length ? unseen : pool;
      pick = src[Math.floor(Math.random() * src.length)];
    }
    setCur(pick);
    setStep(0);
    setSolved(false);
    setWrong(null);
    setHint(false);
    setRevealing(false);
    setRevealed(false);
    setMsg("Find the best move.");
  }, [pool, seen, mode, progress.rating]);

  useEffect(() => {
    if (view === "solve" && !loading && pool.length > 0 && !cur) next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, pool.length, cur, view]);

  useEffect(() => () => {
    if (revealRef.current) clearInterval(revealRef.current);
    if (wrongRef.current) clearTimeout(wrongRef.current);
  }, []);

  // auto-play the opponent's replies (odd steps) and finish
  useEffect(() => {
    if (!cur || revealing) return;
    if (step >= cur.m.length) return;
    if (step % 2 === 1) {
      const t = setTimeout(() => {
        setStep((s) => s + 1);
      }, 420);
      return () => clearTimeout(t);
    }
  }, [step, cur, revealing]);

  useEffect(() => {
    if (!cur) return;
    if (step >= cur.m.length && !solved) {
      setSolved(true);
      const clean = !revealed;
      // Elo update + streak bookkeeping, then persist. A reveal (or give-up)
      // scores 0 and resets the streak; a clean solve scores 1 and extends it.
      setProgress((prev) => {
        const streak = clean ? prev.streak + 1 : 0;
        const nxt: PuzzleProgress = {
          solved: prev.solved + (clean ? 1 : 0),
          streak,
          best: Math.max(prev.best, streak),
          rating: nextRating(prev.rating, cur.r, clean),
          attempts: prev.attempts + 1,
        };
        try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(nxt)); } catch { /* ignore */ }
        return nxt;
      });
      if (clean) {
        // Count the solve against the theme it came from, for the type cards.
        setThemeCounts((prev) => {
          const nxt = { ...prev, [cur.t]: (prev[cur.t] ?? 0) + 1 };
          try { localStorage.setItem(THEMES_KEY, JSON.stringify(nxt)); } catch { /* ignore */ }
          return nxt;
        });
      }
      if (revealed) {
        setMsg("Solution shown — try the next one.");
      } else {
        setMsg("Solved! 🎉");
      }
      setSeen((s) => new Set(s).add(cur.f));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, cur]);

  const fen = cur ? fenAfter(cur.f, cur.m, step) : null;
  const userTurn = !!cur && !solved && !revealing && step % 2 === 0 && step < cur.m.length;

  function onMove(mv: { from: string; to: string; promotion?: string }) {
    if (!cur || !userTurn) return;
    const u = cur.m[step];
    if (mv.from === u.slice(0, 2) && mv.to === u.slice(2, 4)) {
      setStep((s) => s + 1);
    } else {
      setWrong(mv.to);
      setMsg("Not the best move — try again.");
      if (wrongRef.current) clearTimeout(wrongRef.current);
      wrongRef.current = setTimeout(() => setWrong(null), 1100);
    }
  }

  function reveal() {
    if (!cur) return;
    setRevealing(true);
    setRevealed(true);
    setHint(false);
    setWrong(null);
    setMsg("Solution shown.");
    let i = step;
    if (revealRef.current) clearInterval(revealRef.current);
    revealRef.current = setInterval(() => {
      i += 1;
      setStep(i);
      if (i >= cur.m.length) {
        if (revealRef.current) clearInterval(revealRef.current);
        revealRef.current = null;
        setRevealing(false);
      }
    }, 600);
  }

  function skip() {
    if (cur) setSeen((s) => new Set(s).add(cur.f));
    next();
  }

  function startTheme(t: string) {
    setTheme(t);
    setCur(null);
    setView("solve");
  }

  const markers = [
    ...(hint && cur && step < cur.m.length ? [{ square: cur.m[step].slice(0, 2), label: "?", color: "#e0c04d" }] : []),
    ...(wrong ? [{ square: wrong, label: "✗", color: "#e0554d" }] : []),
  ];

  // The solver is always the side to move in the puzzle's START position.
  const userColor: "white" | "black" = cur?.f.split(" ")[1] === "b" ? "black" : "white";
  const sideToMove = userColor === "black" ? "Black" : "White";

  const rank = rankOf(progress.rating);
  const goalTarget = rank.next ? rank.next.min : progress.rating;
  const goalPct = rank.next
    ? Math.max(0, Math.min(100, Math.round(((progress.rating - rank.current.min) / (goalTarget - rank.current.min)) * 100)))
    : 100;

  return (
    <div className="container section">
      <h2>Puzzles</h2>
      <p className="sub">
        Tactics trainer — {all.length.toLocaleString("en-IN")} puzzles across {themes.length} themes.
        Difficulty adapts to your rating as you solve. Find the best move; the opponent replies
        automatically.
      </p>

      {/* ---------- rating + rank ---------- */}
      <div className="rankcard">
        <div className="pz-stats">
          <div>
            <span className="lbl">Puzzle rating</span>
            <strong className="big">{progress.rating}</strong>
          </div>
          <div>
            <span className="lbl">Puzzles solved</span>
            <strong className="big">{progress.solved}</strong>
          </div>
          <div>
            <span className="lbl">Best streak</span>
            <strong className="big">{progress.best}</strong>
          </div>
        </div>
        <div className="rank-top" style={{ marginTop: 12 }}>
          <div>
            <span className="lbl">Current rank</span>
            <strong>{rank.current.name}</strong>
          </div>
          <div className="right">
            <span className="lbl">Next rank</span>
            <strong>{rank.next ? rank.next.name : "Complete"}</strong>
          </div>
        </div>
        <div className="ranktrack">
          <span className="chev" aria-hidden="true">‹</span>
          {RANKS.map((r, i) => (
            <button
              key={r.name}
              type="button"
              className={`node ${i < rank.index ? "done" : i === rank.index ? "cur" : ""}`}
              title={`${r.name} — from ${r.min}`}
            >
              {r.min}
            </button>
          ))}
          <span className="chev" aria-hidden="true">›</span>
        </div>
        <div className="lvl-bar">
          <span style={{ width: `${goalPct}%` }} />
        </div>
        <div className="muted small" style={{ marginTop: 8 }}>
          {rank.next
            ? `Goal: reach ${rank.next.name} — ${progress.rating}/${goalTarget}`
            : "Top rank reached — keep the streak alive."}
        </div>
      </div>

      {/* ---------- theme grid ---------- */}
      {view === "types" ? (
        <>
          <div className="sec-head">
            <h3 style={{ margin: 0, fontSize: 17 }}>Puzzle types</h3>
            <span className="muted small">
              {themeCounts && Object.keys(themeCounts).length
                ? `${Object.values(themeCounts).reduce((a, b) => a + b, 0)} solved by theme`
                : "Pick a theme to start"}
            </span>
          </div>
          <div className="cards-strip pz-grid">
            <button type="button" className="op-card" onClick={() => startTheme("all")}>
              <span className="pz-mixed" aria-hidden="true">♞</span>
              <span className="op-card-name">Mixed</span>
              <span className="op-card-meta">all themes</span>
            </button>
            {themeCards.map((c) => {
              const done = themeCounts[c.theme] ?? 0;
              return (
                <button
                  key={c.theme}
                  type="button"
                  className="op-card"
                  title={prettyTheme(c.theme)}
                  onClick={() => startTheme(c.theme)}
                >
                  <MiniBoard fen={c.fen} size={88} />
                  <span className="op-card-name">{prettyTheme(c.theme)}</span>
                  <span className="op-card-meta">
                    {done}/{c.total}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="sec-head">
            <button className="btn" type="button" onClick={() => { setView("types"); setCur(null); }}>
              ‹ All types
            </button>
            <span className="muted small">
              {theme === "all" ? "Mixed" : prettyTheme(theme)} · {pool.length.toLocaleString("en-IN")} puzzles
            </span>
          </div>

          <div className="toolbar">
            <select value={theme} onChange={(e) => { setTheme(e.target.value); setCur(null); }}>
              <option value="all">All themes</option>
              {themes.map((t) => (
                <option key={t} value={t}>
                  {prettyTheme(t)}
                </option>
              ))}
            </select>
            <select value={mode} onChange={(e) => { setMode(e.target.value); setCur(null); }}>
              <option value={ADAPTIVE}>Adaptive (my rating)</option>
              {BANDS.map((b) => (
                <option key={b.label} value={b.label}>
                  {b.label}
                </option>
              ))}
            </select>
            <button className="btn" type="button" onClick={skip}>
              Skip
            </button>
            <span className="muted small" style={{ marginLeft: "auto" }}>
              streak {progress.streak} · best {progress.best}
            </span>
          </div>

          <div className="two-col">
            <div>
              <div className="statusbar">
                <span className="dot-status" />
                <span>{msg}</span>
              </div>

              {fen && (
                <Board
                  fen={fen}
                  onMove={onMove}
                  orientation={userColor}
                  markers={markers}
                  lastMove={
                    step > 0 && cur
                      ? { from: cur.m[step - 1].slice(0, 2), to: cur.m[step - 1].slice(2, 4) }
                      : null
                  }
                />
              )}

              <div className="replay-controls" style={{ marginTop: 12 }}>
                <button type="button" onClick={() => { setHint(true); setMsg("Hint: move the marked piece."); }} disabled={!userTurn}>
                  Hint
                </button>
                <button type="button" onClick={reveal} disabled={!cur || solved}>
                  Solution
                </button>
                <button type="button" onClick={() => { if (revealRef.current) { clearInterval(revealRef.current); revealRef.current = null; } setRevealing(false); setStep(0); setSolved(false); setRevealed(false); setWrong(null); setHint(false); setMsg("Find the best move."); }} disabled={!cur}>
                  Reset
                </button>
                <button type="button" onClick={next} disabled={!cur}>
                  Next
                </button>
              </div>
            </div>

            <div>
              <div className="card">
                <h3 style={{ fontSize: 15 }}>
                  {cur ? prettyTheme(theme === "all" ? cur.t : theme) : "Loading…"}
                </h3>
                <div className="muted small" style={{ marginTop: 4 }}>
                  {cur ? `${sideToMove} to play · rated ${cur.r} · ${cur.m.length} plies` : ""}
                </div>
                <div className="phase-row" style={{ marginTop: 10 }}>
                  <span className="pill">solved {progress.solved}</span>
                  <span className="pill">streak {progress.streak}</span>
                  <span className="pill">rating {progress.rating}</span>
                </div>
                <p className="small muted" style={{ margin: "12px 0 0" }}>
                  Find the best move for {sideToMove}. The opponent&apos;s reply is played for you;
                  keep going until the sequence ends.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {loading && (
        <p className="muted">
          <span className="spinner" /> Loading puzzles…
        </p>
      )}
    </div>
  );
}
