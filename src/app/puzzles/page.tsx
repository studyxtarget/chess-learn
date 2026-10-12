"use client";

import { Chess } from "chess.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board from "@/components/Board";
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
/** Dropdown value that selects the adaptive (rating-driven) mode. */
const ADAPTIVE = "adaptive";

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

  const themes = useMemo(() => Array.from(new Set(all.map((p) => p.t))).sort(), [all]);

  useEffect(() => {
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
    // Stored JSON is never trusted — loadProgress merges defaults and coerces to Number.
    try {
      setProgress(loadProgress(localStorage.getItem(PROGRESS_KEY)));
    } catch {
      /* ignore */
    }
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
    [all, theme, mode]
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
    if (!loading && pool.length > 0 && !cur) next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, pool.length, cur]);

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
        setMsg("Find the best move.");
      }, 550);
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
    const expected = cur.m[step];
    const got = `${mv.from}${mv.to}${mv.promotion ?? ""}`;
    if (got === expected) {
      setWrong(null);
      setHint(false);
      setStep((s) => s + 1);
      setMsg("✓ Correct");
    } else {
      setWrong(mv.to);
      setMsg("✗ Wrong move — try again");
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

  const markers = [
    ...(hint && cur && step < cur.m.length ? [{ square: cur.m[step].slice(0, 2), label: "?", color: "#e0c04d" }] : []),
    ...(wrong ? [{ square: wrong, label: "✗", color: "#e0554d" }] : []),
  ];

  // The solver is always the side to move in the puzzle's START position.
  const userColor: "white" | "black" = cur?.f.split(" ")[1] === "b" ? "black" : "white";
  const sideToMove = userColor === "black" ? "Black" : "White";

  return (
    <div className="container section">
      <h2>Puzzles</h2>
      <p className="sub">
        Tactics trainer — {all.length.toLocaleString("en-IN")} puzzles across {themes.length} themes. Difficulty
        adapts to your rating as you solve; pick a fixed band to override it. Find the best move; the opponent
        replies automatically.
      </p>

      <div className="toolbar">
        <select value={theme} onChange={(e) => { setTheme(e.target.value); setCur(null); }}>
          <option value="all">All themes</option>
          {themes.map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select value={mode} onChange={(e) => { setMode(e.target.value); setCur(null); }}>
          <option value={ADAPTIVE}>Adaptive (your rating)</option>
          {BANDS.map((b) => (
            <option key={b.label} value={b.label}>Rating band {b.label}</option>
          ))}
        </select>
        <button className="btn" type="button" onClick={skip}>Skip</button>
        <span className="muted small" style={{ marginLeft: "auto" }}>
          Solved {progress.solved} · streak {progress.streak} · best {progress.best}
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
              orientation={userColor}
              interactive={userTurn}
              onMove={onMove}
              markers={markers}
            />
          )}

          <div className="replay-controls" style={{ marginTop: 12 }}>
            <button type="button" onClick={() => { setHint(true); setMsg("Hint: move the marked piece."); }} disabled={!userTurn}>
              Hint
            </button>
            <button type="button" onClick={reveal} disabled={!cur || solved}>Solution</button>
            <button type="button" onClick={() => { if (revealRef.current) { clearInterval(revealRef.current); revealRef.current = null; } setRevealing(false); setStep(0); setSolved(false); setRevealed(false); setWrong(null); setHint(false); setMsg("Find the best move."); }} disabled={!cur}>
              Restart
            </button>
            <button type="button" onClick={next} disabled={!cur}>Next</button>
          </div>
        </div>

        <div>
          <div className="card">
            <h3 style={{ fontSize: 15 }}>
              {cur ? `${cur.t.replace(/_/g, " ")} · ${cur.r}` : "—"}
            </h3>
            <div className="muted small" style={{ marginTop: 4 }}>
              {cur ? `${cur.m.length} plies in the solution · you play ${sideToMove}` : "Pick a theme and mode."}
            </div>
            {cur && (
              <div className="phase-row">
                <span>Step <b>{Math.min(step + 1, cur.m.length)} / {cur.m.length}</b></span>
              </div>
            )}
            <div className="phase-row" style={{ marginTop: 10 }}>
              <span>Your rating <b>{progress.rating}</b></span>
              {cur && <span>This puzzle <b>{cur.r}</b></span>}
            </div>
            <div className="phase-row">
              <span>Solved <b>{progress.solved}</b></span>
              <span>Streak <b>{progress.streak}</b></span>
              <span>Best <b>{progress.best}</b></span>
            </div>
            <p className="small muted" style={{ margin: "12px 0 0" }}>
              Puzzles are loaded from the bundled set. Your rating moves after every puzzle — solve to raise it,
              reveal to lower it. Progress is saved in your browser.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
