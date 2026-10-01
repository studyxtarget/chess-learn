import botsJson from "@/data/bots.json";
import repertoireJson from "@/data/repertoire.json";
import trapsJson from "@/data/traps.json";

export type RepertoireLine = {
  moves: string;
  name: string;
  side: "WHITE" | "BLACK";
  defensive: number;
  neutral: number;
  aggressive: number;
  tags: string[];
  maxCpLoss: number;
  url: string;
};

export type Trap = {
  moves: string;
  name: string;
  variant: string;
  fen: string;
  side: string;
  source: string;
  url: string;
};

export type Bot = {
  id: string;
  file: string;
  index: number | null;
  style: "agg" | "def" | "neutral";
  name: string;
  country: string | null;
  side: "WHITE" | "BLACK";
  line: string | null;
  moves: string | null;
  maxCpLoss: number;
  tags: string[];
  rating: number;
};

export type Opening = {
  moves: string;
  name: string;
  fen: string;
  games: number;
  white: number;
  black: number;
  extra: number;
  /** ECO code, e.g. "C89" — derived from the name (every record has one). */
  eco: string | null;
  /** ECO family letter, e.g. "C". */
  ecoGroup: string | null;
  /** The raw A/D/N column from the source file (a source grouping, not ECO). */
  sourceGroup: string;
};

export const repertoire = repertoireJson as RepertoireLine[];
export const traps = trapsJson as Trap[];
export const bots = botsJson as Bot[];

// When the app is exported for GitHub Pages it is served under /chess-learn/,
// so runtime asset URLs need that prefix. Empty during local development.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const asset = (p: string) => `${BASE_PATH}${p}`;

export function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return "";
  const A = 0x1f1e6;
  const up = code.toUpperCase();
  return String.fromCodePoint(A + (up.charCodeAt(0) - 65), A + (up.charCodeAt(1) - 65));
}

export const styleLabel: Record<string, string> = {
  agg: "Aggressive",
  def: "Defensive",
  neutral: "Balanced",
};

export const styleColor: Record<string, string> = {
  agg: "#e0554d",
  def: "#4d90e0",
  neutral: "#8a8f98",
};
