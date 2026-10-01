"use client";

import { useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import Board from "@/components/Board";
import { bestMove, evaluatePosition } from "@/lib/engine";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const FEN_RE = /^[rnbqkpRNBQKP1-8/]+ [wb] /;

type Ply = { fen: string; san: string; from: string; to: string };

function parseInput(text: string): Chess | null {
  const t = text.trim();
  if (!t) return null;

  // A raw FEN?
  if (FEN_RE.test(t)) {
    try {
      return new Chess(t);
    } catch {
      return null;
    }
  }

  // Full PGN via chess.js
  try {
    const g = new Chess();
    g.loadPgn(t);
    if (g.history().length > 0) return g;
  } catch {
    /* fall through to lenient parse */
  }

  // Lenient: strip headers/comments and replay SAN tokens.
  const body = t.replace(/\[[^\]]*\]/g, " ").replace(/\{[^}]*\}/g, " ").replace(/;[^\n]*/g, " ");
  const tokens = body
    .split(/\s+/)
    .filter((x) => x && !/^\d+\.*$/.test(x) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(x));
  const g = new Chess();
  for (const tok of tokens) {
    try {
      g.move(tok);
    } catch {
      break;
    }
  }
  return g.history().length > 0 ? g : null;
}

export default function AnalyzePage() {
  const gameRef = useRef(new Chess());
  const [history, setHistory] = useState<string[]>([]);
  const [viewPly, setViewPly] = useState(0);
  const [pgnText, setPgnText] = useState("");
  const [status, setStatus] = useState("Ready — paste a PGN or FEN, or play moves on the board.");
  const [analysis, setAnalysis] = useState<{ cp: number; best: string | null } | null>(null);
  const [thinking, setThinking] = useState(false);

  const positions: Ply[] = useMemo(() => {
    const g = new Chess();
    const list: Ply[] = [{ fen: g.fen(), san: "", from: "", to: "" }];
    for (const san of history) {
      try {
        const m = g.move(san);
        list.push({ fen: g.fen(), san: m.san, from: m.from, to: m.to });
      } catch {
        break;
      }
    }
    return list;
  }, [history]);

  function sync(msg?: string) {
    setHistory(gameRef.current.history() as string[]);
    setViewPly(gameRef.current.history().length);
    setAnalysis(null);
    if (msg) setStatus(msg);
  }

  const atHead = viewPly >= positions.length - 1;
  const cur = positions[Math.min(viewPly, positions.length - 1)];
  const lastMove = viewPly > 0 ? { from: positions[viewPly].from, to: positions[viewPly].to } : null;

  function onMove(m: { from: string; to: string; promotion?: string }) {
    if (!atHead) {
      setStatus("Jump to the latest move before playing a new one.");
      return;
    }
    try {
      gameRef.current.move({ from: m.from, to: m.to, promotion: m.promotion || "q" });
    } catch {
      return;
    }
    sync();
  }

  function load() {
    const g = parseInput(pgnText);
    if (!g) {
      setStatus("Could not parse that PGN / FEN.");
      return;
    }
    gameRef.current = g;
    setHistory(g.history() as string[]);
    setViewPly(g.history().length);
    setAnalysis(null);
    setStatus(`Loaded · ${g.history().length} plies`);
  }

  function copyPgn() {
    const text = gameRef.current.pgn();
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => setStatus("PGN copied to clipboard."),
        () => setStatus("Clipboard blocked by the browser.")
      );
    } else {
      setPgnText(text);
      setStatus("PGN placed in the box below.");
    }
  }

  function analyze() {
    const fen = cur.fen;
    setThinking(true);
    setTimeout(() => {
      const cp = evaluatePosition(fen);
      const best = bestMove(fen, 3);
      setAnalysis({ cp, best: best ? best.san : null });
      setThinking(false);
      setStatus(best ? `Engine suggestion: ${best.san}` : "No legal moves.");
    }, 30);
  }

  function newGame() {
    gameRef.current = new Chess();
    setHistory([]);
    setViewPly(0);
    setAnalysis(null);
    setPgnText("");
    setStatus("New game.");
  }

  const evalPawns = analysis ? analysis.cp / 100 : 0;
  const evalPct = analysis ? Math.max(2, Math.min(98, 50 + evalPawns * 3)) : 50;

  return (
    <div className="container section">
      <h2>Analyze</h2>
      <p className="sub">
        Paste a PGN or FEN to study a game, step through the moves, and get an engine read on any
        position. Merged in from the ChessAnalyzer project.
      </p>

      <div className="two-col">
        <div>
          <div className="statusbar">
            <span className="dot-status" />
            <span>{status}</span>
          </div>

          <Board
            fen={cur.fen}
            orientation="white"
            interactive={atHead}
            onMove={onMove}
            lastMove={lastMove}
          />

          <div className="replay-controls" style={{ marginTop: 12 }}>
            <button type="button" onClick={() => setViewPly(0)} aria-label="Start">⏮</button>
            <button type="button" onClick={() => setViewPly((p) => Math.max(0, p - 1))} aria-label="Previous">◀</button>
            <button type="button" onClick={() => setViewPly((p) => Math.min(positions.length - 1, p + 1))} aria-label="Next">▶</button>
            <button type="button" onClick={() => setViewPly(positions.length - 1)} aria-label="End">⏭</button>
          </div>

          <div className="toolbar" style={{ marginTop: 12 }}>
            <button className="btn primary" type="button" onClick={newGame}>New game</button>
            <button className="btn" type="button" onClick={copyPgn}>Copy PGN</button>
            <button className="btn" type="button" onClick={analyze} disabled={thinking}>
              {thinking ? "Analysing…" : "Analyze position"}
            </button>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14 }}>PGN / FEN</h3>
            <textarea
              value={pgnText}
              onChange={(e) => setPgnText(e.target.value)}
              placeholder={'[Event "Game"]\n1. e4 e5 2. Nf3 Nc6 ...\n\n(or a FEN like rnbqkbnr/pppppppp/8/8/... w KQkq - 0 1)'}
              rows={6}
              style={{
                width: "100%", marginTop: 8, background: "var(--bg3)", color: "var(--text)",
                border: "1px solid var(--line)", borderRadius: 9, padding: 10,
                fontFamily: "ui-monospace, monospace", fontSize: 13, resize: "vertical",
              }}
            />
            <div className="toolbar" style={{ marginTop: 10, marginBottom: 0 }}>
              <button className="btn primary" type="button" onClick={load}>Load</button>
              <button className="btn" type="button" onClick={() => setPgnText(gameRef.current.pgn())}>Fill from board</button>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14 }}>Engine</h3>
            {analysis ? (
              <>
                <div className="muted small" style={{ margin: "6px 0 8px" }}>
                  Evaluation: <strong style={{ color: "var(--text)" }}>
                    {evalPawns >= 0 ? "+" : ""}{evalPawns.toFixed(2)}
                  </strong> (White's view)
                  {analysis.best && <> · best move <strong style={{ color: "var(--text)" }}>{analysis.best}</strong></>}
                </div>
                <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", border: "1px solid var(--line)" }}>
                  <div style={{ width: `${evalPct}%`, background: "#e8ebef" }} />
                  <div style={{ flex: 1, background: "#2b3038" }} />
                </div>
                <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>
                  Material + piece-square evaluation from the built-in engine (depth 3 search).
                </p>
              </>
            ) : (
              <p className="small muted" style={{ margin: "6px 0 0" }}>
                Press “Analyze position” to get an evaluation and a suggested move for the current
                position.
              </p>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontSize: 14 }}>Moves</h3>
            <div className="movelist" style={{ marginTop: 8 }}>
              {positions.length <= 1 && <span className="muted small">No moves yet.</span>}
              {positions.slice(1).map((p, i) => (
                <button
                  key={i}
                  type="button"
                  className={viewPly === i + 1 ? "mv active" : "mv"}
                  onClick={() => setViewPly(i + 1)}
                >
                  {i % 2 === 0 && <span className="mvno">{Math.floor(i / 2) + 1}.</span>}
                  {p.san}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
