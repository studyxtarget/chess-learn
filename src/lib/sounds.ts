// Synthesised move sounds — no audio files at all. Short, pleasant Web Audio
// tones, created on demand from a lazily-initialised AudioContext (browsers
// block audio until a user gesture, so we never create it at module load).

import { Chess } from "chess.js";
import { SETTINGS_EVENT } from "@/lib/theme";

export type SoundKey =
  | "move"
  | "capture"
  | "castle"
  | "check"
  | "checkmate"
  | "promotion";

export const SOUND_KEY = "chesslearn.sound";

type MoveLike = {
  from: string;
  to: string;
  promotion?: string;
  captured?: string;
  flags?: string;
};

// ------------------------------------------------------------- audio context ---

let ctx: AudioContext | null = null;
let ctxFailed = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  if (ctxFailed) return null;
  try {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      ctxFailed = true;
      return null;
    }
    ctx = new Ctor();
  } catch {
    ctxFailed = true;
    ctx = null;
  }
  return ctx;
}

// ------------------------------------------------------------------- mute ---

export function isSoundOn(): boolean {
  try {
    const v = typeof window !== "undefined" ? window.localStorage.getItem(SOUND_KEY) : null;
    return v === null ? true : v !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SOUND_KEY, on ? "on" : "off");
    }
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SETTINGS_EVENT));
}

// ------------------------------------------------------------------ tones ---

/** One enveloped oscillator note. Envelope avoids clicks at start/end. */
function tone(
  c: AudioContext,
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType,
  peak = 0.16
): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.03);
}

/**
 * Play a sound. Never throws — a missing or blocked AudioContext is a no-op.
 */
export function playSound(key: SoundKey): void {
  if (!isSoundOn()) return;
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === "suspended") {
      // Resume on the gesture that triggered this call; ignore failures.
      void c.resume().catch(() => {});
    }
    const t = c.currentTime + 0.001;
    switch (key) {
      case "move":
        tone(c, 320, t, 0.08, "sine", 0.14);
        break;
      case "capture":
        tone(c, 200, t, 0.11, "triangle", 0.2);
        tone(c, 130, t, 0.11, "sine", 0.12);
        break;
      case "castle":
        tone(c, 300, t, 0.07, "sine", 0.14);
        tone(c, 430, t + 0.08, 0.09, "sine", 0.14);
        break;
      case "check":
        tone(c, 660, t, 0.09, "square", 0.09);
        tone(c, 880, t + 0.02, 0.09, "sine", 0.1);
        break;
      case "checkmate":
        tone(c, 523, t, 0.12, "sine", 0.16);
        tone(c, 392, t + 0.11, 0.12, "sine", 0.16);
        tone(c, 311, t + 0.22, 0.22, "sine", 0.16);
        break;
      case "promotion":
        tone(c, 440, t, 0.09, "sine", 0.14);
        tone(c, 554, t + 0.09, 0.09, "sine", 0.14);
        tone(c, 659, t + 0.18, 0.13, "sine", 0.14);
        break;
    }
  } catch {
    /* never throw */
  }
}

// -------------------------------------------------------------- classify ---

function applyMove(g: Chess, from: string, to: string, promotion?: string): any {
  try {
    return promotion ? g.move({ from, to, promotion }) : g.move({ from, to });
  } catch {
    // A promotion move with no explicit piece: default to queen.
    try {
      return g.move({ from, to, promotion: "q" });
    } catch {
      return null;
    }
  }
}

/**
 * Decide which sound a move should make by replaying it on a throwaway board
 * and reading the resulting position.
 */
export function classifyMove(fenBefore: string, move: MoveLike): SoundKey {
  try {
    const g = new Chess(fenBefore);
    const res = applyMove(g, move.from, move.to, move.promotion);
    if (!res) return "move";

    if (g.isCheckmate()) return "checkmate";
    if (g.isCheck()) return "check";
    if (res.promotion) return "promotion";

    const flags: string = res.flags || move.flags || "";
    if (flags.includes("k") || flags.includes("q")) return "castle";
    if (res.captured || move.captured || flags.includes("c") || flags.includes("e")) {
      return "capture";
    }
    return "move";
  } catch {
    return "move";
  }
}

/**
 * Convenience helper for code paths that commit a move outside <Board> (e.g.
 * the bot reply on the Play page): classify and play in one call.
 */
export function playMoveSound(fenBefore: string, move: MoveLike): SoundKey {
  const key = classifyMove(fenBefore, move);
  playSound(key);
  return key;
}
