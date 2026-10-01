import { Chess } from "chess.js";
import type { Bot } from "./data";

/* ------------------------------------------------------------------ *
 * A compact, self-contained chess engine used for the computer
 * opponents. It is an original implementation: alpha-beta search over
 * a material + piece-square-table evaluation, with a per-bot
 * "personality" term layered on top, and opening-book guidance taken
 * from the bot repertoire data.
 * ------------------------------------------------------------------ */

const VAL: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// Tables are written from White's point of view, index 0 = a8 ... 63 = h1.
const PST: Record<string, number[]> = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5, 10, 10,  5,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
     0,  0,  5,  5,  5,  5,  0, -5,
   -10,  5,  5,  5,  5,  5,  0,-10,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0,  0, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20,
  ],
};

const FILES = "abcdefgh";

function pstIndex(square: string, color: "w" | "b"): number {
  const f = FILES.indexOf(square[0]);
  const r = parseInt(square[1], 10); // 1..8
  if (color === "w") return (8 - r) * 8 + f;
  return (r - 1) * 8 + f;
}

export type Personality = { agg: number; def: number; neu: number };

function materialAndPst(game: Chess): number {
  let score = 0;
  const board = game.board();
  for (const row of board) {
    for (const sq of row) {
      if (!sq) continue;
      const v = VAL[sq.type] + (PST[sq.type]?.[pstIndex(sq.square, sq.color)] ?? 0);
      score += sq.color === "w" ? v : -v;
    }
  }
  return score;
}

function personalityTerm(game: Chess, side: "w" | "b", p: Personality): number {
  const board = game.board();
  let term = 0;
  const enemy: "w" | "b" = side === "w" ? "b" : "w";
  const homeRank = side === "w" ? 1 : 8;
  const forward = side === "w" ? 1 : -1;

  let kingSq: string | null = null;
  for (const row of board) for (const sq of row) {
    if (sq && sq.type === "k" && sq.color === enemy) kingSq = sq.square;
  }

  for (const row of board) {
    for (const sq of row) {
      if (!sq || sq.color !== side) continue;
      const r = parseInt(sq.square[1], 10);
      const advance = side === "w" ? r - 2 : 7 - r; // 0..5 for pawns
      // Aggressive bots like activity in the enemy half and pawn storms.
      if (p.agg > 0) {
        const inEnemyHalf = side === "w" ? r >= 5 : r <= 4;
        if (inEnemyHalf) term += p.agg * 3;
        if (sq.type === "p" && advance > 0) term += p.agg * advance * 2;
        if (kingSq) {
          const d =
            Math.max(
              Math.abs(FILES.indexOf(sq.square[0]) - FILES.indexOf(kingSq[0])),
              Math.abs(r - parseInt(kingSq[1], 10))
            );
          if (d <= 2) term += p.agg * 4;
        }
      }
      // Defensive bots value a king pawn shield and keeping the king home.
      if (p.def > 0 && sq.type === "p") {
        const kf = kingSq ? FILES.indexOf(kingSq[0]) : 4;
        const df = Math.abs(FILES.indexOf(sq.square[0]) - kf);
        const dRank = Math.abs(r - homeRank);
        if (df <= 1 && dRank <= 2) term += p.def * 5;
      }
    }
  }
  return term;
}

function evaluate(game: Chess, side: "w" | "b", p: Personality): number {
  const white = materialAndPst(game);
  const mine = side === "w" ? white : -white;
  const pers = personalityTerm(game, side, p);
  return mine + pers;
}

function orderMoves(moves: any[]): any[] {
  return [...moves].sort((a: any, b: any) => {
    const av = (a.captured ? VAL[a.captured] : 0) + (a.promotion ? 800 : 0);
    const bv = (b.captured ? VAL[b.captured] : 0) + (b.promotion ? 800 : 0);
    return bv - av;
  });
}

function negamax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  side: "w" | "b",
  p: Personality
): number {
  if (game.isCheckmate()) return -100000 + (10 - depth) * 100;
  if (game.isDraw() || game.isStalemate()) return 0;
  if (depth === 0) return evaluate(game, side, p);

  let best = -Infinity;
  const moves = orderMoves(game.moves({ verbose: true }) as any);
  for (const m of moves) {
    game.move(m);
    const score = -negamax(game, depth - 1, -beta, -alpha, side === "w" ? "b" : "w", p);
    game.undo();
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export type BotMove = {
  san: string;
  from: string;
  to: string;
  promotion?: string;
  source: "repertoire" | "engine";
};

function normalizeSan(s: string): string {
  return s
    .replace(/[+#]/g, "")
    .replace(/[!?]/g, "")
    .replace(/0/g, "O")
    .trim();
}

/** Try to follow the bot's stored opening line for the current game. */
function repertoireMove(game: Chess, historySan: string[], bot: Bot): BotMove | null {
  if (!bot.moves) return null;
  const line = bot.moves.split(/\s+/).filter(Boolean);
  if (historySan.length >= line.length) return null;
  for (let i = 0; i < historySan.length; i++) {
    if (normalizeSan(historySan[i]) !== normalizeSan(line[i])) return null;
  }
  const nextSan = line[historySan.length];
  try {
    const m = game.move(nextSan);
    game.undo();
    return { san: m.san, from: m.from, to: m.to, promotion: m.promotion, source: "repertoire" };
  } catch {
    return null;
  }
}

export function botMove(fen: string, historySan: string[], bot: Bot): BotMove | null {
  const game = new Chess(fen);
  if (game.isGameOver()) return null;

  const book = repertoireMove(game, historySan, bot);
  if (book) return book;

  const side = game.turn();
  const p: Personality =
    bot.style === "agg"
      ? { agg: 1, def: 0, neu: 0 }
      : bot.style === "def"
      ? { agg: 0, def: 1, neu: 0 }
      : { agg: 0.15, def: 0.15, neu: 1 };

  const strength = Math.max(0.45, Math.min(0.98, 0.45 + (bot.rating - 800) / 3500));
  const depth = bot.rating >= 2200 ? 3 : bot.rating >= 1200 ? 2 : 1;

  const legal = game.moves({ verbose: true }) as any[];
  if (legal.length === 0) return null;

  // Weaker bots occasionally play a random legal move (a "blunder").
  if (Math.random() > strength) {
    const r = legal[Math.floor(Math.random() * legal.length)];
    return { san: r.san, from: r.from, to: r.to, promotion: r.promotion, source: "engine" };
  }

  let best: any = null;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const ordered = orderMoves(legal);
  for (const m of ordered) {
    game.move(m);
    const score = -negamax(game, depth - 1, -Infinity, -alpha, side === "w" ? "b" : "w", p);
    game.undo();
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
    if (bestScore > alpha) alpha = bestScore;
  }
  if (!best) best = legal[0];
  return { san: best.san, from: best.from, to: best.to, promotion: best.promotion, source: "engine" };
}

export function evaluateFen(fen: string): number {
  const game = new Chess(fen);
  return materialAndPst(game);
}

/**
 * Neutral, deeper search used by the analysis board (no book, no personality).
 * Returns the engine's preferred move for the side to move.
 */
export function bestMove(fen: string, depth = 3): BotMove | null {
  const game = new Chess(fen);
  if (game.isGameOver()) return null;
  const side = game.turn();
  const p: Personality = { agg: 0, def: 0, neu: 1 };
  const legal = game.moves({ verbose: true }) as any[];
  if (legal.length === 0) return null;

  let best: any = null;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  for (const m of orderMoves(legal)) {
    game.move(m);
    const score = -negamax(game, depth - 1, -Infinity, -alpha, side === "w" ? "b" : "w", p);
    game.undo();
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
    if (bestScore > alpha) alpha = bestScore;
  }
  if (!best) return null;
  return { san: best.san, from: best.from, to: best.to, promotion: best.promotion, source: "engine" };
}

/** Score of a position in centipawns from White's point of view. */
export function evaluatePosition(fen: string): number {
  const game = new Chess(fen);
  return materialAndPst(game);
}
