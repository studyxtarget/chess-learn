"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import Board from "@/components/Board";
import GameReport from "@/components/GameReport";
import { analyzePosition } from "@/lib/engine";
import { makeEvaluator, type EngineLine } from "@/lib/stockfish";
import { reviewGame, CLASS_META, type GameReview } from "@/lib/review";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const FEN_RE = /^[rnbqkpRNBQKP1-8/]+ [wb] /;
const RECENT_KEY = "chesslearn.recentGames";

type Ply = { fen: string; san: string; from: string; to: string };
type Parsed = { game: Chess; startFen: string };
type Recent = { label: string; pgn: string };
type AnnArrow = { from: string; to: string; color?: string };
type AnnCircle = { square: string; label: string; color?: string };

function parseInput(text: string): Parsed | null {
  const t = text.trim();
  if (!t) return null;
  if (FEN_RE.test(t)) {
    try {
      return { game: new Chess(t), startFen: t };
    } catch {
      return null;
    }
  }
  try {
    const g = new Chess();
    g.loadPgn(t);
    if (g.history().length > 0) {
      const headers: any = (g as any).getHeaders?.() ?? {};
      return { game: g, startFen: headers.FEN || START_FEN };
    }
  } catch {
    /* fall through */
  }
  const body = t
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/;[^\n]*/g, " ")
    .replace(/\([^()]*\)/g, " ")
    .replace(/\$\d+/g, " ")
    .replace(/\d+\.(\.\.)?/g, " ")
    .replace(/(1-0|0-1|1\/2-1\/2|\*)/g, " ");
  const tokens = body.split(/\s+/).filter(Boolean);
  const g = new Chess();
  for (const tok of tokens) {
    try {
      g.move(tok);
    } catch {
      break;
    }
  }
  return g.history().length > 0 ? { game: g, startFen: START_FEN } : null;
}

function labelFor(pgn: string, fallback: string): string {
  const w = /\[White "([^"]*)"\]/.exec(pgn)?.[1];
  const b = /\[Black "([^"]*)"\]/.exec(pgn)?.[1];
  if (w && b) return `${w} vs ${b}`;
  const ev = /\[Event "([^"]*)"\]/.exec(pgn)?.[1];
  return ev || fallback;
}

function pvToSan(fen: string, pv: string[], n = 8): string {
  try {
    const g = new Chess(fen);
    const out: string[] = [];
    for (const u of pv.slice(0, n)) {
      const m = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
      out.push(m.san);
    }
    return out.join(" ");
  } catch {
    return pv.slice(0, n).join(" ");
  }
}

function smartDepth(fen: string): number {
  try {
    const g = new Chess(fen);
    const n = g.moves().length;
    const pieces = g.board().flat().filter((s) => s && s.type !== "p" && s.type !== "k").length;
    return Math.max(8, Math.min(16, Math.round(8 + n / 6 + pieces / 6)));
  } catch {
    return 12;
  }
}

function fmtCp(cp: number | null): string {
  if (cp === null) return "—";
  if (Math.abs(cp) >= 9000) return "#";
  return `${cp >= 0 ? "+" : ""}${(cp / 100).toFixed(2)}`;
}

export default function AnalyzePage() {
  const gameRef = useRef(new Chess());
  const fileRef = useRef<HTMLInputElement>(null);

  const [startFen, setStartFen] = useState(START_FEN);
  const [history, setHistory] = useState<string[]>([]);
  const [viewPly, setViewPly] = useState(0);
  const [pgnText, setPgnText] = useState("");
  const [status, setStatus] = useState("Ready — paste a PGN or FEN, or play moves on the board.");
  const [analysis, setAnalysis] = useState<{ cp: number; best: string | null; from: string; to: string } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [flipped, setFlipped] = useState(false);

  const [review, setReview] = useState<GameReview | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [mode, setMode] = useState<"quick" | "deep" | "smart">("quick");
  const stopRef = useRef(false);

  const [lines, setLines] = useState<EngineLine[] | null>(null);
  const [linesLoading, setLinesLoading] = useState(false);

  const [annotate, setAnnotate] = useState(false);
  const [userArrows, setUserArrows] = useState<AnnArrow[]>([]);
  const [userCircles, setUserCircles] = useState<AnnCircle[]>([]);
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);

  const [recent, setRecent] = useState<Recent[]>([]);

  const positions: Ply[] = useMemo(() => {
    const g = new Chess(startFen);
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
  }, [history, startFen]);

  const cur = positions[Math.min(viewPly, positions.length - 1)];
  const atHead = viewPly >= positions.length - 1;
  const lastMove = viewPly > 0 ? { from: positions[viewPly].from, to: positions[viewPly].to } : null;
  const selectedReview = review && viewPly > 0 ? review.moves[viewPly - 1] ?? null : null;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  function pushRecent(pgn: string) {
    if (!pgn.trim()) return;
    setRecent((prev) => {
      const next = [{ label: labelFor(pgn, `Game ${prev.length + 1}`), pgn }, ...prev.filter((r) => r.pgn !== pgn)].slice(0, 8);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function sync(msg?: string) {
    const h = gameRef.current.history() as string[];
    setHistory(h);
    setViewPly(h.length);
    if (msg) setStatus(msg);
  }

  useEffect(() => {
    if (review) {
      setThinking(false);
      return;
    }
    const fen = cur.fen;
    setThinking(true);
    const t = setTimeout(() => {
      const r = analyzePosition(fen, 3);
      setAnalysis({ cp: r.cp, best: r.best ? r.best.san : null, from: r.best?.from ?? "", to: r.best?.to ?? "" });
      setThinking(false);
    }, 140);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur.fen, review]);

  function onMove(m: { from: string; to: string; promotion?: string }) {
    const g = new Chess(startFen);
    for (const san of history.slice(0, viewPly)) g.move(san);
    try {
      g.move({ from: m.from, to: m.to, promotion: m.promotion || "q" });
    } catch {
      return;
    }
    gameRef.current = g;
    setReview(null);
    setLines(null);
    sync();
  }

  function applyParsed(parsed: Parsed, remember?: string) {
    gameRef.current = parsed.game;
    setStartFen(parsed.startFen);
    setHistory(parsed.game.history() as string[]);
    setViewPly(parsed.game.history().length);
    setAnalysis(null);
    setReview(null);
    setLines(null);
    setUserArrows([]);
    setUserCircles([]);
    setPendingFrom(null);
    setStatus(`Loaded · ${parsed.game.history().length} plies`);
    if (remember) pushRecent(remember);
  }

  function load() {
    const parsed = parseInput(pgnText);
    if (!parsed) {
      setStatus("Could not parse that PGN / FEN.");
      return;
    }
    applyParsed(parsed, FEN_RE.test(pgnText.trim()) ? undefined : pgnText);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      setPgnText(text);
      const parsed = parseInput(text);
      if (!parsed) {
        setStatus("Could not parse that file.");
        return;
      }
      applyParsed(parsed, text);
      setStatus(`Loaded ${f.name} · ${parsed.game.history().length} plies`);
    };
    reader.readAsText(f);
    e.target.value = "";
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

  function newGame() {
    gameRef.current = new Chess();
    setStartFen(START_FEN);
    setHistory([]);
    setViewPly(0);
    setAnalysis(null);
    setReview(null);
    setLines(null);
    setPgnText("");
    setUserArrows([]);
    setUserCircles([]);
    setStatus("New game.");
  }

  async function runReview() {
    if (history.length === 0) {
      setStatus("Load or play a game first.");
      return;
    }
    setReviewing(true);
    setReview(null);
    stopRef.current = false;
    const modeCfg =
      mode === "deep"
        ? { depth: 14, label: "depth 14" }
        : mode === "smart"
        ? { depth: smartDepth, label: "smart depth" }
        : { depth: 10, label: "depth 10" };
    setProgress({ done: 0, total: history.length + 1 });
    setStatus("Booting engine…");
    try {
      const { evaluate, kind } = await makeEvaluator();
      setStatus(kind === "stockfish" ? "Stockfish ready — reviewing…" : "Stockfish unavailable — using the built-in engine…");
      const r = await reviewGame(
        startFen,
        history,
        evaluate,
        modeCfg,
        kind,
        (done, total) => setProgress({ done, total }),
        () => stopRef.current
      );
      setReview(r);
      setStatus(`Review complete · ${r.moves.length} moves analysed.`);
    } catch (e) {
      setStatus("Review failed: " + (e as Error).message);
    } finally {
      setReviewing(false);
      setProgress(null);
    }
  }

  async function showLines() {
    setLinesLoading(true);
    setStatus("Getting engine lines…");
    try {
      const { evaluate } = await makeEvaluator();
      const depth = mode === "deep" ? 14 : mode === "smart" ? smartDepth(cur.fen) : 10;
      const r = await evaluate(cur.fen, depth, 3);
      setLines(r.lines);
      setStatus(`Engine lines ready (depth ${r.depth}).`);
    } catch (e) {
      setStatus("Engine lines failed: " + (e as Error).message);
    } finally {
      setLinesLoading(false);
    }
  }

  function onSquareClick(sq: string, shift: boolean) {
    if (!pendingFrom) {
      setPendingFrom(sq);
      return;
    }
    if (pendingFrom === sq) {
      setUserCircles((cs) =>
        cs.some((c) => c.square === sq) ? cs.filter((c) => c.square !== sq) : [...cs, { square: sq, label: "", color: "#4d90e0" }]
      );
      setPendingFrom(null);
      return;
    }
    const from = pendingFrom;
    setUserArrows((as) => [
      ...as.filter((a) => !(a.from === from && a.to === sq)),
      { from, to: sq, color: shift ? "#e0554d" : "#4d90e0" },
    ]);
    setPendingFrom(null);
  }

  function clearAnnotations() {
    setUserArrows([]);
    setUserCircles([]);
    setPendingFrom(null);
  }

  const cp = review ? review.evalSeries[viewPly] ?? 0 : analysis?.cp ?? 0;
  const isMate = Math.abs(cp) >= 9000;
  const whiteFrac = isMate ? (cp > 0 ? 1 : 0) : Math.max(0.03, Math.min(0.97, 0.5 + cp / 1600));
  const evalLabel = isMate ? "#" : `${cp >= 0 ? "+" : ""}${(cp / 100).toFixed(2)}`;

  const bestUci = selectedReview?.bestUci ?? null;
  const autoArrows = bestUci
    ? [{ from: bestUci.slice(0, 2), to: bestUci.slice(2, 4), color: "#6aa84f" }]
    : analysis?.from
    ? [{ from: analysis.from, to: analysis.to, color: "#6aa84f" }]
    : [];
  const PROBLEM = ["inaccuracy", "mistake", "blunder", "missed-win"];
  const autoMarkers =
    selectedReview && PROBLEM.includes(selectedReview.classification)
      ? [
          {
            square: selectedReview.to,
            label: CLASS_META[selectedReview.classification].badge,
            color: CLASS_META[selectedReview.classification].color,
          },
        ]
      : [];

  const boardArrows = annotate || userArrows.length ? userArrows : autoArrows;
  const boardMarkers = [
    ...autoMarkers,
    ...userCircles,
    ...(pendingFrom ? [{ square: pendingFrom, label: "•", color: "#4d90e0" }] : []),
  ];

  return (
    <div className="container section">
      <h2>Analyze</h2>
      <p className="sub">
        Paste or upload a PGN, step through the game, run a full Stockfish review, and annotate the
        board yourself.
      </p>

      <div className="two-col">
        <div>
          <div className="statusbar">
            <span className="dot-status" />
            <span>{status}</span>
          </div>

          <div className="evalbar" title="Evaluation (White's point of view)">
            <div className="evalbar-white" style={{ width: `${whiteFrac * 100}%` }} />
            <div className="evalbar-black" />
            <span className="evalbar-label">{evalLabel}</span>
          </div>

          <Board
            fen={cur.fen}
            orientation={flipped ? "black" : "white"}
            interactive={!annotate}
            onMove={onMove}
            lastMove={lastMove}
            arrows={boardArrows}
            markers={boardMarkers}
            annotateMode={annotate}
            onSquareClick={onSquareClick}
          />

          <div className="replay-controls" style={{ marginTop: 12 }}>
            <button type="button" onClick={() => setViewPly(0)} aria-label="First">⏮</button>
            <button type="button" onClick={() => setViewPly((p) => Math.max(0, p - 1))} aria-label="Previous">◀</button>
            <button type="button" onClick={() => setViewPly((p) => Math.min(positions.length - 1, p + 1))} aria-label="Next">▶</button>
            <button type="button" onClick={() => setViewPly(positions.length - 1)} aria-label="Last">⏭</button>
          </div>

          <div className="toolbar" style={{ marginTop: 12 }}>
            <button className="btn primary" type="button" onClick={newGame}>New game</button>
            <button className="btn" type="button" onClick={copyPgn}>Copy PGN</button>
            <button className="btn" type="button" onClick={() => fileRef.current?.click()}>Upload PGN</button>
            <input ref={fileRef} type="file" accept=".pgn,.txt" onChange={onFile} style={{ display: "none" }} />
            <button className="btn" type="button" onClick={() => setFlipped((v) => !v)}>Flip</button>
          </div>

          <div className="toolbar">
            <button
              className={annotate ? "btn primary" : "btn"}
              type="button"
              onClick={() => { setAnnotate((v) => !v); setPendingFrom(null); }}
            >
              {annotate ? "Annotating…" : "Annotate"}
            </button>
            <button className="btn" type="button" onClick={clearAnnotations} disabled={!userArrows.length && !userCircles.length}>
              Clear
            </button>
            {annotate && (
              <span className="muted small">Click two squares for an arrow · click a square twice for a circle · Shift = red</span>
            )}
          </div>

          {!atHead && (
            <p className="small muted" style={{ marginTop: 8 }}>
              Viewing move {viewPly} of {positions.length - 1}. Play a move to branch from here — the
              rest of the line is truncated.
            </p>
          )}
        </div>

        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14 }}>PGN / FEN</h3>
            <textarea
              value={pgnText}
              onChange={(e) => setPgnText(e.target.value)}
              placeholder={'[Event "Game"]\n1. e4 e5 2. Nf3 Nc6 ...\n\n(or a FEN like rnbqkbnr/pppppppp/8/8/... w KQkq - 0 1)'}
              rows={5}
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
            {recent.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="muted small" style={{ marginBottom: 6 }}>Recent games</div>
                <div className="rows">
                  {recent.map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      className="row"
                      onClick={() => {
                        setPgnText(r.pgn);
                        const parsed = parseInput(r.pgn);
                        if (parsed) applyParsed(parsed);
                      }}
                    >
                      <div className="grow">
                        <div className="rname">{r.label}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14 }}>Full-game review</h3>
            <p className="small muted" style={{ margin: "6px 0 10px" }}>
              Stockfish scores every position. {history.length} moves to analyse.
            </p>
            <div className="toolbar" style={{ marginBottom: 10 }}>
              <button className={mode === "quick" ? "btn primary" : "btn"} type="button" onClick={() => setMode("quick")}>
                Quick
              </button>
              <button className={mode === "deep" ? "btn primary" : "btn"} type="button" onClick={() => setMode("deep")}>
                Deep
              </button>
              <button className={mode === "smart" ? "btn primary" : "btn"} type="button" onClick={() => setMode("smart")}>
                Smart
              </button>
            </div>
            <div className="toolbar" style={{ marginBottom: 0 }}>
              <button className="btn primary" type="button" onClick={runReview} disabled={reviewing || history.length === 0}>
                {reviewing ? "Reviewing…" : "Review game"}
              </button>
              <button className="btn" type="button" onClick={showLines} disabled={linesLoading}>
                {linesLoading ? "…" : "Engine lines"}
              </button>
              {reviewing && (
                <button className="btn" type="button" onClick={() => { stopRef.current = true; }}>Stop</button>
              )}
            </div>
            <p className="small muted" style={{ margin: "8px 0 0" }}>
              Quick = depth 10 · Deep = depth 14 · Smart = depth adapts to how complex each position is.
            </p>
            {progress && (
              <div style={{ marginTop: 10 }}>
                <div className="wtrack" style={{ height: 8 }}>
                  <div className="wfill" style={{ width: `${(progress.done / progress.total) * 100}%`, background: "var(--accent)" }} />
                </div>
                <div className="muted small" style={{ marginTop: 4 }}>{progress.done} / {progress.total} positions</div>
              </div>
            )}
          </div>

          {lines && lines.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14 }}>Engine lines</h3>
              <div style={{ marginTop: 8 }}>
                {lines.map((l) => (
                  <div key={l.multipv} className="engine-line">
                    <span className="el-eval">{fmtCp(l.cp)}</span>
                    <span className="el-pv mono">{pvToSan(cur.fen, l.pv)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedReview ? (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14 }}>Move detail</h3>
              <div style={{ marginTop: 6 }}>
                <span style={{ color: CLASS_META[selectedReview.classification].color, fontWeight: 700 }}>
                  {CLASS_META[selectedReview.classification].badge} {CLASS_META[selectedReview.classification].label}
                </span>
                <span className="muted small">
                  {" "}· {selectedReview.moveNo}
                  {selectedReview.color === "w" ? "." : "..."} {selectedReview.san}
                </span>
              </div>
              <table style={{ width: "100%", marginTop: 10, fontSize: 13, borderCollapse: "collapse" }}>
                <tbody>
                  <tr><td className="muted">Eval before</td><td style={{ textAlign: "right" }}>{fmtCp(selectedReview.evalBeforeCp)}</td></tr>
                  <tr><td className="muted">Eval after</td><td style={{ textAlign: "right" }}>{fmtCp(selectedReview.evalAfterCp)}</td></tr>
                  <tr><td className="muted">Best move</td><td style={{ textAlign: "right", fontWeight: 600 }}>{selectedReview.bestSan ?? "—"}</td></tr>
                  <tr><td className="muted">Lost</td><td style={{ textAlign: "right" }}>{(selectedReview.cpLoss / 100).toFixed(2)} pawns</td></tr>
                  <tr><td className="muted">Move accuracy</td><td style={{ textAlign: "right" }}>{selectedReview.accuracy.toFixed(0)}%</td></tr>
                </tbody>
              </table>
              <p className="why">
                <b>Why?</b>{" "}
                {selectedReview.bestSan
                  ? `Best was ${selectedReview.bestSan}, keeping the evaluation at ${fmtCp(selectedReview.evalBeforeCp)}. `
                  : ""}
                {selectedReview.san} gave away {(selectedReview.cpLoss / 100).toFixed(2)} pawns (
                {fmtCp(selectedReview.evalBeforeCp)} → {fmtCp(selectedReview.evalAfterCp)}).
              </p>
            </div>
          ) : (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14 }}>Engine</h3>
              <div className="muted small" style={{ margin: "6px 0 8px" }}>
                {thinking && !analysis ? (
                  <span><span className="spinner" /> Analysing…</span>
                ) : (
                  <>
                    Evaluation: <strong style={{ color: "var(--text)" }}>{evalLabel}</strong> (White&apos;s view)
                    {analysis?.best && <> · best move <strong style={{ color: "var(--text)" }}>{analysis.best}</strong></>}
                    {analysis && !analysis.best && <> · no legal moves</>}
                  </>
                )}
              </div>
              <p className="small muted" style={{ margin: 0 }}>
                Quick position read from the built-in engine. Run a full-game review for Stockfish
                accuracy and move classification.
              </p>
            </div>
          )}

          {review && <GameReport review={review} onSelectPly={(p) => setViewPly(p)} />}

          <div className="card">
            <h3 style={{ fontSize: 14 }}>Moves</h3>
            <div className="movelist" style={{ marginTop: 8 }}>
              {positions.length <= 1 && <span className="muted small">No moves yet.</span>}
              {positions.slice(1).map((p, i) => {
                const r = review?.moves[i];
                return (
                  <button
                    key={i}
                    type="button"
                    className={viewPly === i + 1 ? "mv active" : "mv"}
                    onClick={() => setViewPly(i + 1)}
                  >
                    {i % 2 === 0 && <span className="mvno">{Math.floor(i / 2) + 1}.</span>}
                    {p.san}
                    {r && r.classification !== "best" && (
                      <span style={{ color: CLASS_META[r.classification].color, marginLeft: 3, fontWeight: 700 }}>
                        {CLASS_META[r.classification].badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
