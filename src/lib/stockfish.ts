import { asset } from "./data";
import { analyzePosition } from "./engine";

/* ------------------------------------------------------------------ *
 * Browser Stockfish (WASM) client.
 *
 * Runs the "lite single-threaded" Stockfish 19 build in a Web Worker
 * and speaks just enough UCI for the analysis board, including MultiPV
 * (several engine lines). Single-threaded means no SharedArrayBuffer /
 * COOP+COEP headers are required, so it works on plain GitHub Pages.
 *
 * Stockfish is GPL-3.0 — see public/stockfish/NOTICE.txt and COPYING.txt.
 * ------------------------------------------------------------------ */

export type EngineLine = {
  multipv: number;
  cp: number | null; // White POV
  mate: number | null; // White POV
  pv: string[];
};

export type EngineEval = {
  /** Centipawns, always from White's point of view. */
  cp: number | null;
  /** Signed mate distance from White's point of view. */
  mate: number | null;
  /** Best move in UCI (e.g. "e2e4"). */
  bestmove: string | null;
  /** Principal variation in UCI. */
  pv: string[];
  depth: number;
  /** All requested lines, best first. */
  lines: EngineLine[];
};

export type Evaluator = (fen: string, depth: number, multiPV?: number) => Promise<EngineEval>;

const INIT_TIMEOUT_MS = 45000;

type RawLine = { cp: number | null; mate: number | null; pv: string[]; depth: number };

class StockfishClient {
  private worker: Worker;
  private ready: Promise<void>;
  private uciOk = false;
  private chain: Promise<unknown> = Promise.resolve();
  private cur: {
    resolve: (v: EngineEval) => void;
    lines: Map<number, RawLine>;
    bestmove: string | null;
    turn: "w" | "b";
  } | null = null;

  constructor() {
    this.worker = new Worker(asset("/stockfish/stockfish.js"));
    this.worker.onmessage = (e) => this.onLine(String(e.data));
    this.ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Stockfish init timed out")), INIT_TIMEOUT_MS);
      const poll = setInterval(() => {
        if (this.uciOk) {
          clearTimeout(timer);
          clearInterval(poll);
          resolve();
        }
      }, 40);
      this.worker.onerror = (e) => {
        clearTimeout(timer);
        clearInterval(poll);
        reject(new Error((e as ErrorEvent).message || "Stockfish worker failed to load"));
      };
      this.worker.postMessage("uci");
    });
  }

  private onLine(line: string) {
    if (line === "uciok") {
      this.uciOk = true;
      this.worker.postMessage("setoption name Threads value 1");
      this.worker.postMessage("setoption name Hash value 16");
      return;
    }
    const c = this.cur;
    if (!c) return;

    if (line.startsWith("info ")) {
      const mpv = /(?:^|\s)multipv (\d+)/.exec(line);
      const k = mpv ? parseInt(mpv[1], 10) : 1;
      const d = /(?:^|\s)depth (\d+)/.exec(line);
      const cp = /(?:^|\s)score cp (-?\d+)/.exec(line);
      const mate = /(?:^|\s)score mate (-?\d+)/.exec(line);
      const pv = /(?:^|\s)pv (.+)$/.exec(line);

      const prev = c.lines.get(k) ?? { cp: null, mate: null, pv: [], depth: 0 };
      const next: RawLine = { ...prev };
      if (d) next.depth = Math.max(prev.depth, parseInt(d[1], 10));
      if (cp) {
        next.cp = parseInt(cp[1], 10);
        next.mate = null;
      } else if (mate) {
        next.mate = parseInt(mate[1], 10);
        next.cp = null;
      }
      if (pv) next.pv = pv[1].trim().split(/\s+/);
      c.lines.set(k, next);
      return;
    }

    if (line.startsWith("bestmove")) {
      const bm = line.split(/\s+/)[1] || null;
      this.cur = null;
      const sign = c.turn === "w" ? 1 : -1;
      const keys = [...c.lines.keys()].sort((a, b) => a - b);
      const lines: EngineLine[] = keys.map((k) => {
        const l = c.lines.get(k)!;
        return {
          multipv: k,
          cp: l.cp === null ? null : l.cp * sign,
          mate: l.mate === null ? null : l.mate * sign,
          pv: l.pv,
        };
      });
      const primary = c.lines.get(1) ?? { cp: null, mate: null, pv: [], depth: 0 };
      c.resolve({
        cp: primary.cp === null ? null : primary.cp * sign,
        mate: primary.mate === null ? null : primary.mate * sign,
        bestmove: bm && bm !== "(none)" ? bm : null,
        pv: primary.pv,
        depth: primary.depth,
        lines,
      });
    }
  }

  private go(fen: string, depth: number, multiPV: number): Promise<EngineEval> {
    const turn: "w" | "b" = fen.split(" ")[1] === "b" ? "b" : "w";
    return new Promise<EngineEval>((resolve) => {
      this.cur = { resolve, lines: new Map(), bestmove: null, turn };
      this.worker.postMessage(`setoption name MultiPV value ${multiPV}`);
      this.worker.postMessage("position fen " + fen);
      this.worker.postMessage("go depth " + depth);
    });
  }

  async evaluate(fen: string, depth: number, multiPV = 1): Promise<EngineEval> {
    await this.ready;
    const run = this.chain.then(() => this.go(fen, depth, multiPV));
    this.chain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  newGame() {
    this.worker.postMessage("ucinewgame");
  }

  quit() {
    try {
      this.worker.postMessage("quit");
      this.worker.terminate();
    } catch {
      /* ignore */
    }
  }
}

let client: StockfishClient | null = null;

function getClient(): StockfishClient {
  if (!client) client = new StockfishClient();
  return client;
}

export function disposeStockfish() {
  client?.quit();
  client = null;
}

/** Evaluator backed by the built-in engine — used if Stockfish can't load. */
export const builtinEvaluator: Evaluator = async (fen, depth) => {
  const r = analyzePosition(fen, Math.max(2, Math.min(4, depth >= 12 ? 4 : 3)));
  const uci = r.best ? `${r.best.from}${r.best.to}${r.best.promotion ?? ""}` : null;
  return {
    cp: r.cp,
    mate: null,
    bestmove: uci,
    pv: uci ? [uci] : [],
    depth: 3,
    lines: [{ multipv: 1, cp: r.cp, mate: null, pv: uci ? [uci] : [] }],
  };
};

export type EngineKind = "stockfish" | "builtin";

/**
 * Returns the best available evaluator. Tries to boot Stockfish in a worker
 * and falls back to the built-in engine (so the feature always works).
 */
export async function makeEvaluator(): Promise<{ evaluate: Evaluator; kind: EngineKind }> {
  try {
    const c = getClient();
    await c.evaluate("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", 1, 1);
    c.newGame();
    return { evaluate: (fen, depth, multiPV = 1) => c.evaluate(fen, depth, multiPV), kind: "stockfish" };
  } catch {
    return { evaluate: builtinEvaluator, kind: "builtin" };
  }
}
