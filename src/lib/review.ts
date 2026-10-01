import { Chess } from "chess.js";
import type { EngineEval, Evaluator, EngineKind } from "./stockfish";

/* ------------------------------------------------------------------ *
 * Full-game review: evaluates every position once, then derives
 * centipawn loss, win-probability drop, per-move accuracy and a
 * classification for each move — plus phase accuracy, an estimated
 * rating and a short narrative.
 *
 * Thresholds follow the common (Lichess-style) convention of win% drop:
 *   inaccuracy >= 10, mistake >= 20, blunder >= 30 percentage points.
 * ------------------------------------------------------------------ */

export type Classification =
  | "book"
  | "brilliant"
  | "best"
  | "excellent"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder"
  | "missed-win";

export const CLASSIFICATIONS: Classification[] = [
  "book",
  "brilliant",
  "best",
  "excellent",
  "good",
  "inaccuracy",
  "mistake",
  "blunder",
  "missed-win",
];

export const CLASS_META: Record<Classification, { label: string; color: string; badge: string }> = {
  book: { label: "Book", color: "#a1795a", badge: "♟" },
  brilliant: { label: "Brilliant", color: "#2fa8a0", badge: "!!" },
  best: { label: "Best", color: "#6aa84f", badge: "★" },
  excellent: { label: "Excellent", color: "#8fbf6a", badge: "✓" },
  good: { label: "Good", color: "#9aa4b2", badge: "·" },
  inaccuracy: { label: "Inaccuracy", color: "#e0c04d", badge: "?!" },
  mistake: { label: "Mistake", color: "#e08a3d", badge: "?" },
  blunder: { label: "Blunder", color: "#e0554d", badge: "??" },
  "missed-win": { label: "Missed win", color: "#c94f9a", badge: "×" },
};

export type Phase = "opening" | "middlegame" | "endgame";

export type MoveReview = {
  ply: number;
  moveNo: number;
  color: "w" | "b";
  san: string;
  playedUci: string;
  bestUci: string | null;
  bestSan: string | null;
  evalBeforeCp: number; // White POV
  evalAfterCp: number; // White POV
  cpLoss: number; // mover POV, >= 0
  winDrop: number; // percentage points
  accuracy: number; // 0..100
  classification: Classification;
  phase: Phase;
  to: string; // destination square of the played move
  from: string;
};

export type SideReport = {
  accuracy: number;
  estRating: number;
  avgCpl: number;
  counts: Record<Classification, number>;
  phases: { opening: number | null; middlegame: number | null; endgame: number | null };
};

export type GameReview = {
  moves: MoveReview[];
  white: SideReport;
  black: SideReport;
  evalSeries: number[]; // White POV cp, one per position (length = plies + 1)
  narrative: string;
  engine: EngineKind;
  depthLabel: string;
};

const MATE_CP = 10000;
const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const BOOK_PLIES = 12;

export function cpOf(e: EngineEval): number {
  if (e.mate !== null) {
    const mag = MATE_CP - Math.min(99, Math.abs(e.mate)) * 10;
    return e.mate > 0 ? mag : -mag;
  }
  return e.cp ?? 0;
}

/** Win probability (%) for the side the score belongs to. */
export function winPct(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368 * cp)) - 1);
}

/** Per-move accuracy from the win% drop. */
export function moveAccuracy(winDrop: number): number {
  const a = 103.17 * Math.exp(-0.0435 * Math.max(0, winDrop)) - 3.17;
  return Math.max(0, Math.min(100, a));
}

/** Rough accuracy -> rating mapping (calibrated to the common report style). */
export function estimateRating(accuracy: number): number {
  const r = Math.round(32 * accuracy - 1342);
  return Math.max(100, Math.min(2800, r));
}

export function uciToSan(fen: string, uci: string | null): string | null {
  if (!uci) return null;
  try {
    const g = new Chess(fen);
    const m = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
    return m.san;
  } catch {
    return null;
  }
}

/* ---------------- opening book ---------------- */

let bookPromise: Promise<Set<string>> | null = null;

function norm(s: string): string {
  return s.replace(/[+#!?]/g, "").replace(/0/g, "O");
}

/** Set of normalised move-prefixes that appear in the bundled opening lines. */
function getBookSet(): Promise<Set<string>> {
  if (!bookPromise) {
    bookPromise = fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/data/openings.json`)
      .then((r) => r.json())
      .then((rows: { moves: string }[]) => {
        const set = new Set<string>();
        for (const row of rows) {
          const toks = row.moves.split(/\s+/).slice(0, BOOK_PLIES);
          let acc: string[] = [];
          for (const t of toks) {
            acc = [...acc, norm(t)];
            set.add(acc.join(" "));
          }
        }
        return set;
      })
      .catch(() => new Set<string>());
  }
  return bookPromise;
}

/* ---------------- phases ---------------- */

function materialPoints(fen: string): number {
  const board = fen.split(" ")[0];
  let pts = 0;
  for (const ch of board) {
    const lower = ch.toLowerCase();
    if (VAL[lower] !== undefined && lower !== "k") pts += VAL[lower];
  }
  return pts;
}

/* ---------------- helpers ---------------- */

function classify(
  winDrop: number,
  isBest: boolean,
  isBook: boolean,
  isMissedWin: boolean,
  isBrilliant: boolean
): Classification {
  if (isMissedWin) return "missed-win";
  if (isBook) return "book";
  if (isBrilliant) return "brilliant";
  if (isBest) return "best";
  if (winDrop < 5) return "excellent";
  if (winDrop < 10) return "good";
  if (winDrop < 20) return "inaccuracy";
  if (winDrop < 30) return "mistake";
  return "blunder";
}

function sideReport(moves: MoveReview[], color: "w" | "b"): SideReport {
  const list = moves.filter((m) => m.color === color);
  const counts = {
    book: 0, brilliant: 0, best: 0, excellent: 0, good: 0,
    inaccuracy: 0, mistake: 0, blunder: 0, "missed-win": 0,
  } as Record<Classification, number>;
  for (const m of list) counts[m.classification]++;

  const accuracy = list.length ? list.reduce((s, m) => s + m.accuracy, 0) / list.length : 0;
  const phaseAcc = (ph: Phase) => {
    const sub = list.filter((m) => m.phase === ph);
    return sub.length ? sub.reduce((s, m) => s + m.accuracy, 0) / sub.length : null;
  };
  const avgCpl = list.length ? list.reduce((s, m) => s + m.cpLoss, 0) / list.length : 0;
  return {
    accuracy,
    estRating: estimateRating(accuracy),
    avgCpl,
    counts,
    phases: { opening: phaseAcc("opening"), middlegame: phaseAcc("middlegame"), endgame: phaseAcc("endgame") },
  };
}

/* ---------------- main ---------------- */

export async function reviewGame(
  startFen: string,
  sans: string[],
  evaluate: Evaluator,
  mode: { depth: number | ((fen: string) => number); label: string },
  engine: EngineKind,
  onProgress?: (done: number, total: number) => void,
  shouldStop?: () => boolean
): Promise<GameReview> {
  const book = await getBookSet();

  const g = new Chess(startFen);
  const fens: string[] = [g.fen()];
  const played: { san: string; uci: string; color: "w" | "b"; moveNo: number; from: string; to: string; piece: string }[] = [];
  for (const san of sans) {
    const m = g.move(san);
    fens.push(g.fen());
    played.push({
      san: m.san,
      uci: `${m.from}${m.to}${m.promotion ?? ""}`,
      color: m.color,
      moveNo: Math.floor(played.length / 2) + 1,
      from: m.from,
      to: m.to,
      piece: m.piece,
    });
  }

  const evals: EngineEval[] = [];
  for (let i = 0; i < fens.length; i++) {
    if (shouldStop?.()) break;
    const d = typeof mode.depth === "function" ? mode.depth(fens[i]) : mode.depth;
    evals.push(await evaluate(fens[i], d));
    onProgress?.(i + 1, fens.length);
  }

  const moves: MoveReview[] = [];
  let prefix: string[] = [];

  for (let i = 0; i < played.length && i + 1 < evals.length; i++) {
    const p = played[i];
    prefix = [...prefix, norm(p.san)];

    const beforeCp = cpOf(evals[i]);
    const afterCp = cpOf(evals[i + 1]);
    const sign = p.color === "w" ? 1 : -1;
    const beforeMover = beforeCp * sign;
    const afterMover = afterCp * sign;
    const cpLoss = Math.max(0, beforeMover - afterMover);
    const winDrop = Math.max(0, winPct(beforeMover) - winPct(afterMover));
    const isBest = evals[i].bestmove !== null && evals[i].bestmove === p.uci;

    const isBook = i < BOOK_PLIES && book.has(prefix.join(" "));
    const isMissedWin = winPct(beforeMover) >= 80 && winPct(afterMover) < 65;

    // Brilliant: a sacrifice (piece can be taken by something cheaper) that still holds.
    let isBrilliant = false;
    if (!isBook && !isMissedWin && (isBest || winDrop < 5) && i + 1 < fens.length) {
      try {
        const after = new Chess(fens[i + 1]);
        const caps = (after.moves({ verbose: true }) as any[]).filter(
          (m) => m.to === p.to && m.captured
        );
        if (caps.length) {
          const cheapest = Math.min(...caps.map((m) => VAL[m.piece] ?? 99));
          const mine = VAL[p.piece] ?? 0;
          if (mine >= 3 && mine - cheapest >= 2) isBrilliant = true;
        }
      } catch {
        /* ignore */
      }
    }

    const pts = materialPoints(fens[i]);
    const phase: Phase = i < 20 && pts > 20 ? "opening" : pts <= 20 ? "endgame" : "middlegame";

    moves.push({
      ply: i + 1,
      moveNo: p.moveNo,
      color: p.color,
      san: p.san,
      playedUci: p.uci,
      bestUci: evals[i].bestmove,
      bestSan: uciToSan(fens[i], evals[i].bestmove),
      evalBeforeCp: beforeCp,
      evalAfterCp: afterCp,
      cpLoss,
      winDrop,
      accuracy: moveAccuracy(winDrop),
      classification: classify(winDrop, isBest, isBook, isMissedWin, isBrilliant),
      phase,
      from: p.from,
      to: p.to,
    });
  }

  const white = sideReport(moves, "w");
  const black = sideReport(moves, "b");

  // Narrative — templated from the data, no invented analysis.
  let narrative = "";
  const worst = [...moves].sort((a, b) => b.winDrop - a.winDrop)[0];
  const better = white.accuracy >= black.accuracy ? "White" : "Black";
  if (worst && worst.winDrop >= 10) {
    const mover = worst.color === "w" ? "White" : "Black";
    const moveTxt = `${worst.moveNo}${worst.color === "w" ? "." : "..."} ${worst.san}`;
    narrative =
      `${mover} played ${moveTxt} (${CLASS_META[worst.classification].label.toLowerCase()}), the turning point. ` +
      `${better} was the more accurate side overall (${Math.max(white.accuracy, black.accuracy).toFixed(1)}%).`;
  } else if (moves.length) {
    narrative = `A clean game — neither side gave away much. ${better} was slightly more accurate (${Math.max(
      white.accuracy,
      black.accuracy
    ).toFixed(1)}%).`;
  }

  return {
    moves,
    white,
    black,
    evalSeries: evals.map(cpOf),
    narrative,
    engine,
    depthLabel: mode.label,
  };
}
