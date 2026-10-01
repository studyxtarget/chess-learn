import { Chess } from "chess.js";
import type { EngineEval, Evaluator, EngineKind } from "./stockfish";

/* ------------------------------------------------------------------ *
 * Full-game review: evaluates every position once, then derives
 * centipawn loss, win-probability drop, per-move accuracy and a
 * classification for each move.
 *
 * Thresholds follow the common (Lichess-style) convention of win% drop:
 *   inaccuracy >= 10, mistake >= 20, blunder >= 30 percentage points.
 * ------------------------------------------------------------------ */

export type Classification = "best" | "excellent" | "good" | "inaccuracy" | "mistake" | "blunder";

export const CLASSIFICATIONS: Classification[] = [
  "best",
  "excellent",
  "good",
  "inaccuracy",
  "mistake",
  "blunder",
];

export const CLASS_META: Record<Classification, { label: string; color: string; badge: string }> = {
  best: { label: "Best", color: "#6aa84f", badge: "★" },
  excellent: { label: "Excellent", color: "#8fbf6a", badge: "!" },
  good: { label: "Good", color: "#9aa4b2", badge: "·" },
  inaccuracy: { label: "Inaccuracy", color: "#e0c04d", badge: "?!" },
  mistake: { label: "Mistake", color: "#e08a3d", badge: "?" },
  blunder: { label: "Blunder", color: "#e0554d", badge: "??" },
};

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
};

export type SideReport = {
  accuracy: number;
  counts: Record<Classification, number>;
};

export type GameReview = {
  moves: MoveReview[];
  white: SideReport;
  black: SideReport;
  evalSeries: number[]; // White POV cp, one per position (length = plies + 1)
  engine: EngineKind;
  depth: number;
};

const MATE_CP = 10000;

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

function classify(winDrop: number, isBest: boolean): Classification {
  if (isBest) return "best";
  if (winDrop < 5) return "excellent";
  if (winDrop < 10) return "good";
  if (winDrop < 20) return "inaccuracy";
  if (winDrop < 30) return "mistake";
  return "blunder";
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

function sideReport(moves: MoveReview[], color: "w" | "b"): SideReport {
  const list = moves.filter((m) => m.color === color);
  const counts = { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 } as Record<
    Classification,
    number
  >;
  for (const m of list) counts[m.classification]++;
  const accuracy = list.length ? list.reduce((s, m) => s + m.accuracy, 0) / list.length : 0;
  return { accuracy, counts };
}

export async function reviewGame(
  startFen: string,
  sans: string[],
  evaluate: Evaluator,
  depth: number,
  engine: EngineKind,
  onProgress?: (done: number, total: number) => void,
  shouldStop?: () => boolean
): Promise<GameReview> {
  // Replay the game once to collect every position and the played moves.
  const g = new Chess(startFen);
  const fens: string[] = [g.fen()];
  const played: { san: string; uci: string; color: "w" | "b"; moveNo: number }[] = [];
  for (const san of sans) {
    const m = g.move(san);
    fens.push(g.fen());
    played.push({
      san: m.san,
      uci: `${m.from}${m.to}${m.promotion ?? ""}`,
      color: m.color,
      moveNo: Math.floor(played.length / 2) + 1,
    });
  }

  // One engine evaluation per position.
  const evals: EngineEval[] = [];
  for (let i = 0; i < fens.length; i++) {
    if (shouldStop?.()) break;
    evals.push(await evaluate(fens[i], depth));
    onProgress?.(i + 1, fens.length);
  }

  const moves: MoveReview[] = [];
  for (let i = 0; i < played.length && i + 1 < evals.length; i++) {
    const p = played[i];
    const beforeCp = cpOf(evals[i]);
    const afterCp = cpOf(evals[i + 1]);
    const sign = p.color === "w" ? 1 : -1;
    const beforeMover = beforeCp * sign;
    const afterMover = afterCp * sign;
    const cpLoss = Math.max(0, beforeMover - afterMover);
    const winDrop = Math.max(0, winPct(beforeMover) - winPct(afterMover));
    const isBest = evals[i].bestmove !== null && evals[i].bestmove === p.uci;
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
      classification: classify(winDrop, isBest),
    });
  }

  return {
    moves,
    white: sideReport(moves, "w"),
    black: sideReport(moves, "b"),
    evalSeries: evals.map(cpOf),
    engine,
    depth,
  };
}
