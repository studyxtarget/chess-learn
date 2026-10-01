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
  eco: string;
};

export const repertoire = repertoireJson as RepertoireLine[];
export const traps = trapsJson as Trap[];
export const bots = botsJson as Bot[];

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

export function ecoGroup(name: string): string {
  const m = name.match(/^([A-E])\d{2}/);
  return m ? m[1] : "#";
}
