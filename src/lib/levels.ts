// Opening "levels" — a beginner-to-master ladder built from how much theory a
// line actually contains. Short mainlines come first; long forcing lines with
// rare sidelines sit at the top. Nothing here is copied from another app: the
// bands are our own, chosen so each level holds a playable number of lines.

export type Level = {
  /** 1-based level number. */
  n: number;
  /** Short name shown on the level banner. */
  name: string;
  /** One-line description of what the level teaches. */
  blurb: string;
  /** Lowest half-move (ply) count in this level. */
  min: number;
  /** Highest ply count in this level. */
  max: number;
};

export const LEVELS: Level[] = [
  {
    n: 1,
    name: "Beginner",
    blurb: "The opening moves themselves — short, safe lines every player should know.",
    min: 1,
    max: 4,
  },
  {
    n: 2,
    name: "Improver",
    blurb: "Two- and three-move plans that already shape the middlegame.",
    min: 5,
    max: 6,
  },
  {
    n: 3,
    name: "Intermediate",
    blurb: "Fuller mainlines where the plans start to matter.",
    min: 7,
    max: 8,
  },
  {
    n: 4,
    name: "Advanced",
    blurb: "Deeper theory with sharper, more forcing branches.",
    min: 9,
    max: 11,
  },
  {
    n: 5,
    name: "Expert",
    blurb: "Long forcing lines and rare sidelines.",
    min: 12,
    max: 15,
  },
  {
    n: 6,
    name: "Master",
    blurb: "Tournament-grade theory — sixteen moves and beyond.",
    min: 16,
    max: 999,
  },
];

/** Which level a line belongs to, given its number of plies. */
export function levelOf(plies: number): Level {
  return LEVELS.find((l) => plies >= l.min && plies <= l.max) ?? LEVELS[LEVELS.length - 1];
}

export const PROGRESS_KEY = "chesslearn.openingProgress";

/** A stable id for one opening line (names repeat across ECO families). */
export function openingKey(name: string, moves: string): string {
  return `${name}|${moves}`;
}

export function readProgress(): Record<string, true> {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(PROGRESS_KEY) : null;
    return raw ? (JSON.parse(raw) as Record<string, true>) : {};
  } catch {
    return {};
  }
}

export function writeProgress(p: Record<string, true>): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* private mode / quota — ignore */
  }
}
