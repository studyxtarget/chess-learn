/* ------------------------------------------------------------------ *
 * Adaptive puzzle rating.
 *
 * The tactics trainer used to serve puzzles from a fixed rating band.
 * This module keeps a per-user rating and drives an Elo update after
 * every finished puzzle, then picks the next puzzle from the pool
 * nearest to that rating — so difficulty tracks the solver.
 *
 * The pure helpers here are deliberately free of React/DOM so the page
 * can own all state and this file stays trivially testable.
 * ------------------------------------------------------------------ */

/** The minimum shape a puzzle needs to be rated and de-duplicated. */
export type RatedPuzzle = { r: number; f: string };

/** Everything persisted under the progress key (all fields are numbers). */
export type PuzzleProgress = {
  solved: number;
  streak: number;
  best: number;
  rating: number;
  attempts: number;
};

export const DEFAULT_RATING = 1200;
export const MIN_RATING = 800;
export const MAX_RATING = 2400;
/** Elo K-factor: how far one result can move the rating. */
export const K_FACTOR = 32;
/** How many of the nearest puzzles stay in the weighted draw. */
export const NEAREST_COUNT = 15;

export const DEFAULT_PROGRESS: PuzzleProgress = {
  solved: 0,
  streak: 0,
  best: 0,
  rating: DEFAULT_RATING,
  attempts: 0,
};

/** Coerce anything to a finite number, else fall back. */
function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Clamp a rating into the supported range. */
export function clampRating(r: number): number {
  return Math.min(MAX_RATING, Math.max(MIN_RATING, Math.round(r)));
}

/**
 * Parse the stored progress, merging with defaults and coercing every
 * field to a number — stored JSON is never trusted (it may be missing,
 * corrupt, or hand-edited).
 */
export function loadProgress(raw: string | null): PuzzleProgress {
  if (!raw) return { ...DEFAULT_PROGRESS };
  try {
    const d = JSON.parse(raw) as Record<string, unknown> | null;
    return {
      solved: Math.max(0, Math.round(num(d?.solved, 0))),
      streak: Math.max(0, Math.round(num(d?.streak, 0))),
      best: Math.max(0, Math.round(num(d?.best, 0))),
      rating: clampRating(num(d?.rating, DEFAULT_RATING)),
      attempts: Math.max(0, Math.round(num(d?.attempts, 0))),
    };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

/** Elo expected score for the user against a puzzle of the given rating. */
export function expectedScore(userRating: number, puzzleRating: number): number {
  return 1 / (1 + 10 ** ((puzzleRating - userRating) / 400));
}

/**
 * Elo update: score s = 1 for a clean solve, 0 for a reveal / give-up.
 * delta = round(K * (s - expected)); the result is clamped.
 */
export function nextRating(userRating: number, puzzleRating: number, solved: boolean): number {
  const s = solved ? 1 : 0;
  const delta = Math.round(K_FACTOR * (s - expectedScore(userRating, puzzleRating)));
  return clampRating(userRating + delta);
}

/**
 * Pick the next puzzle from the theme-filtered pool: prefer puzzles not
 * yet seen, take the ~15 nearest to the user's rating, then draw one
 * weighted by closeness. Weighting (rather than taking the single
 * nearest) keeps the trainer from locking onto one rating and lets the
 * set drift as the user improves.
 */
export function pickPuzzle<T extends RatedPuzzle>(
  pool: T[],
  userRating: number,
  seen: Set<string>
): T | null {
  if (pool.length === 0) return null;
  const unseen = pool.filter((p) => !seen.has(p.f));
  const candidates = unseen.length > 0 ? unseen : pool;
  const nearest = [...candidates]
    .sort((a, b) => Math.abs(a.r - userRating) - Math.abs(b.r - userRating))
    .slice(0, NEAREST_COUNT);
  const weights = nearest.map((p) => 1 / (1 + Math.abs(p.r - userRating) / 50));
  const total = weights.reduce((a, w) => a + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < nearest.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return nearest[i];
  }
  return nearest[nearest.length - 1];
}
