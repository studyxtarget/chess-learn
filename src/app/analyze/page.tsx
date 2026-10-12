"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import Board from "@/components/Board";
import GameReport from "@/components/GameReport";
import { analyzePosition } from "@/lib/engine";
import { makeEvaluator, disposeStockfish, type EngineLine } from "@/lib/stockfish";
import {
  reviewGame, CLASS_META, CLASSIFICATIONS, norm, getOpeningIndex,
  type GameReview, type Classification,
} from "@/lib/review";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const FEN_RE = /^[rnbqkpRNBQKP1-8/]+ [wb] /;
const RECENT_KEY = "chesslearn.recentGames";

type Ply = { fen: string; san: string; from: string; to: string };
type Parsed = { game: Chess; startFen: string; warning?: string };
type Recent = { label: string; pgn: string };
type AnnArrow = { from: string; to: string; color?: string };
type AnnCircle = { square: string; label: string; color?: string };
type Names = { white: string; black: string; whiteElo: string; blackElo: string };

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
  const fenHeader = /\[FEN\s+"([^"]+)"\]/.exec(t)?.[1];
  const body = t
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/;[^\n]*/g, " ")
    .replace(/\([^()]*\)/g, " ")
    .replace(/\$\d+/g, " ")
    .replace(/\d+\.(\.\.)?/g, " ")
    .replace(/(1-0|0-1|1\/2-1\/2|\*)/g, " ");
  const tokens = body.split(/\s+/).filter(Boolean);
  let g: Chess;
  try {
    g = fenHeader ? new Chess(fenHeader) : new Chess();
  } catch {
    g = new Chess();
  }
  let parsed = 0;
  let stoppedAt: string | null = null;
  for (const tok of tokens) {
    try {
      g.move(tok);
      parsed++;
    } catch {
      stoppedAt = tok;
      break;
    }
  }
  if (g.history().length === 0) return null;
  return {
    game: g,
    startFen: fenHeader ?? START_FEN,
    warning: stoppedAt
      ? `Only ${parsed} of ${tokens.length} moves could be read — parsing stopped at “${stoppedAt}”. The game may be incomplete.`
      : undefined,
  };
}

// Review results are cached per (start position + moves + mode).
const reviewCache = new Map<string, GameReview>();
const REVIEW_CACHE_MAX = 6;

function namesFrom(pgn: string): Names {
  const get = (k: string) => new RegExp(`\\[${k} "([^"]*)"\\]`).exec(pgn)?.[1] ?? "";
  return {
    white: get("White") || "White",
    black: get("Black") || "Black",
    whiteElo: get("WhiteElo"),
    blackElo: get("BlackElo"),
  };
}

function pvToSan(fen: string, pv: string[], n = 10): string {
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
  const [status, setStatus] = useState("Paste or upload a PGN, then run a report.");
  const [analysis, setAnalysis] = useState<{ cp: number; best: string | null; from: string; to: string; depth: number } | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [names, setNames] = useState<Names>({ white: "White", black: "Black", whiteElo: "", blackElo: "" });

  const [review, setReview] = useState<GameReview | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [mode, setMode] = useState<"quick" | "deep" | "smart">("quick");
  const [showReport, setShowReport] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const stopRef = useRef(false);

  const [lines, setLines] = useState<EngineLine[] | null>(null);
  const [linesLoading, setLinesLoading] = useState(false);
  const [openIdx, setOpenIdx] = useState<Map<string, string> | null>(null);

  const [annotate, setAnnotate] = useState(false);
  const [userArrows, setUserArrows] = useState<AnnArrow[]>([]);
  const [userCircles, setUserCircles] = useState<AnnCircle[]>([]);
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);

  const [recent, setRecent] = useState<Recent[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [engineKind, setEngineKind] = useState<"stockfish" | "builtin" | null>(null);

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
    getOpeningIndex().then(setOpenIdx).catch(() => {});
  }, []);

  // Terminate the Stockfish worker when leaving the screen.
  useEffect(() => () => disposeStockfish(), []);

  // auto-scroll the move ribbon to the active move
  useEffect(() => {
    const el = document.querySelector(".mvchip.active");
    if (el) (el as HTMLElement).scrollIntoView({ inline: "center", block: "nearest" });
  }, [viewPly]);

  useEffect(() => {
    if (!autoPlay) return;
    if (viewPly >= positions.length - 1) {
      setAutoPlay(false);
      return;
    }
    const t = setTimeout(() => setViewPly((p) => p + 1), 900);
    return () => clearTimeout(t);
  }, [autoPlay, viewPly, positions.length]);

  function pushRecent(pgn: string) {
    if (!pgn.trim()) return;
    setRecent((prev) => {
      const label = namesFrom(pgn);
      const nm = label.white !== "White" ? `${label.white} vs ${label.black}` : `Game ${prev.length + 1}`;
      const next = [{ label: nm, pgn }, ...prev.filter((r) => r.pgn !== pgn)].slice(0, 8);
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
    if (review) return;
    const fen = cur.fen;
    const t = setTimeout(() => {
      const r = analyzePosition(fen, 3);
      setAnalysis({ cp: r.cp, best: r.best ? r.best.san : null, from: r.best?.from ?? "", to: r.best?.to ?? "", depth: 3 });
    }, 120);
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
    setShowReport(false);
    setWarning(parsed.warning ?? null);
    setStatus(parsed.warning ? "Loaded with a warning — see above." : `Loaded · ${parsed.game.history().length} plies`);
    if (remember) {
      pushRecent(remember);
      setNames(namesFrom(remember));
    } else {
      setNames({ white: "White", black: "Black", whiteElo: "", blackElo: "" });
    }
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

  function copyText(text: string, what: string) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => setStatus(`${what} copied.`),
        () => setStatus("Clipboard blocked by the browser.")
      );
    } else {
      setStatus(`Copy not supported here.`);
    }
  }

  async function runReview(m: "quick" | "deep" | "smart" = mode, open = true) {
    if (history.length === 0) {
      setStatus("Load or play a game first.");
      return;
    }
    setMode(m);
    setReviewing(true);
    setReview(null);
    setShowReport(false);
    stopRef.current = false;
    const cfg =
      m === "deep" ? { depth: 14, label: "depth 14" } : m === "smart" ? { depth: smartDepth, label: "smart depth" } : { depth: 10, label: "depth 10" };
    const cacheKey = `${startFen}|${history.join(" ")}|${cfg.label}|${engineKind ?? "?"}`;
    const cached = reviewCache.get(cacheKey);
    if (cached) {
      setReview(cached);
      setStatus("Report ready (cached).");
      if (open) setShowReport(true);
      setReviewing(false);
      setProgress(null);
      return;
    }
    setProgress({ done: 0, total: history.length + 1 });
    setStatus("Booting engine…");
    try {
      const { evaluate, kind } = await makeEvaluator();
      setEngineKind(kind);
      setStatus(kind === "stockfish" ? "Analysing with Stockfish…" : "Stockfish unavailable — analysing with the basic engine…");
      const r = await reviewGame(startFen, history, evaluate, cfg, kind, (d, t) => setProgress({ done: d, total: t }), () => stopRef.current);
      setReview(r);
      reviewCache.set(cacheKey, r);
      if (reviewCache.size > REVIEW_CACHE_MAX) {
        const first = reviewCache.keys().next().value;
        if (first) reviewCache.delete(first);
      }
      setStatus(`Report ready · ${r.moves.length} moves.`);
      if (open) setShowReport(true);
    } catch (e) {
      setStatus("Review failed: " + (e as Error).message);
    } finally {
      setReviewing(false);
      setProgress(null);
    }
  }

  async function showLines() {
    setLinesLoading(true);
    try {
      const { evaluate, kind } = await makeEvaluator();
      setEngineKind(kind);
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
      setUserCircles((cs) => (cs.some((c) => c.square === sq) ? cs.filter((c) => c.square !== sq) : [...cs, { square: sq, label: "", color: "#4d90e0" }]));
      setPendingFrom(null);
      return;
    }
    const from = pendingFrom;
    setUserArrows((as) => [...as.filter((a) => !(a.from === from && a.to === sq)), { from, to: sq, color: shift ? "#e0554d" : "#4d90e0" }]);
    setPendingFrom(null);
  }

  const seriesCp = review ? review.evalSeries[viewPly] : undefined;
  const cpKnown = seriesCp !== undefined || !!analysis;
  const cp = seriesCp ?? analysis?.cp ?? 0;
  const isMate = Math.abs(cp) >= 9000;
  const whiteFrac = isMate ? (cp > 0 ? 1 : 0) : Math.max(0.03, Math.min(0.97, 0.5 + cp / 1600));
  const evalLabel = !cpKnown
    ? "—"
    : isMate
    ? cp > 0
      ? "+M"
      : "-M"
    : `${cp >= 0 ? "+" : ""}${(cp / 100).toFixed(2)}`;
  // Never claim a depth/engine that did not produce the number on screen.
  const depthShown = review?.depthLabel ?? "built-in engine · depth 3";

  const opening = useMemo(() => {
    if (!openIdx) return null;
    let best: string | null = null;
    let acc: string[] = [];
    for (let i = 0; i < Math.min(viewPly, history.length); i++) {
      acc = [...acc, norm(history[i])];
      const n = openIdx.get(acc.join(" "));
      if (n) best = n;
    }
    return best;
  }, [openIdx, history, viewPly]);

  const bestUci = selectedReview?.bestUci ?? null;
  const autoArrows = bestUci
    ? [{ from: bestUci.slice(0, 2), to: bestUci.slice(2, 4), color: "#6aa84f" }]
    : analysis?.from
    ? [{ from: analysis.from, to: analysis.to, color: "#6aa84f" }]
    : [];
  const PROBLEM: Classification[] = ["inaccuracy", "mistake", "blunder", "missed-win"];
  const autoMarkers =
    selectedReview && PROBLEM.includes(selectedReview.classification)
      ? [{ square: selectedReview.to, label: CLASS_META[selectedReview.classification].badge, color: CLASS_META[selectedReview.classification].color }]
      : [];
  const boardArrows = annotate || userArrows.length ? userArrows : autoArrows;
  const boardMarkers = [...autoMarkers, ...userCircles, ...(pendingFrom ? [{ square: pendingFrom, label: "•", color: "#4d90e0" }] : [])];

  const pvText = lines?.[0] ? pvToSan(cur.fen, lines[0].pv) : selectedReview?.bestSan ? selectedReview.bestSan : analysis?.best ?? "";

  const topName = flipped ? names.white : names.black;
  const topElo = flipped ? names.whiteElo : names.blackElo;
  const botName = flipped ? names.black : names.white;
  const botElo = flipped ? names.blackElo : names.whiteElo;

  const totals = useMemo(() => {
    const t = {} as Record<Classification, number>;
    for (const c of CLASSIFICATIONS) t[c] = (review?.white.counts[c] ?? 0) + (review?.black.counts[c] ?? 0);
    return t;
  }, [review]);

  return (
    <div className="an">
      {/* ---------- move ribbon ---------- */}
      <div className="move-ribbon">
        {positions.slice(1).map((p, i) => {
          const r = review?.moves[i];
          const color = r ? CLASS_META[r.classification].color : undefined;
          return (
            <button
              key={i}
              type="button"
              className={`mvchip${viewPly === i + 1 ? " active" : ""}`}
              style={color ? { borderColor: color, color } : undefined}
              onClick={() => setViewPly(i + 1)}
            >
              {i % 2 === 0 && <span className="mvn">{Math.floor(i / 2) + 1}.</span>}
              {p.san}
              {r && r.classification !== "best" && <span className="mvb">{CLASS_META[r.classification].badge}</span>}
            </button>
          );
        })}
        {positions.length <= 1 && <span className="muted small" style={{ padding: "8px 4px" }}>No moves yet</span>}
        <button type="button" className="ribbon-add" onClick={() => fileRef.current?.click()} title="Load a PGN">＋</button>
      </div>

      {warning && (
        <div className="container" style={{ paddingTop: 12 }}>
          <div className="warn-banner">
            <b>Import warning:</b> {warning}
            <button type="button" onClick={() => setWarning(null)} aria-label="Dismiss">✕</button>
          </div>
        </div>
      )}

      <div className="container an-grid">
        {/* ---------- board column ---------- */}
        <div className="an-boardcol">
          <div className="player-bar">
            <span className="pb-name">{topName}</span>
            {topElo && <span className="pb-elo">({topElo})</span>}
            <button type="button" className="pb-toggle" onClick={() => setFlipped((v) => !v)} title="Flip board">⇅</button>
          </div>

          <div className="evalbar">
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

          <div className="player-bar bottom">
            <span className="pb-name">{botName}</span>
            {botElo && <span className="pb-elo">({botElo})</span>}
            <span className="pb-spacer" />
            <button type="button" className="pb-toggle" onClick={() => setAutoPlay((v) => !v)} title="Auto-play">
              {autoPlay ? "❚❚" : "▶"}
            </button>
          </div>

          <div className="engine-strip">
            <span className="es-eval">{evalLabel}</span>
            <span className="es-depth">({depthShown})</span>
            <span className="es-pv mono">{pvText || "—"}</span>
          </div>

          <div className="ctrl-bar">
            <button type="button" onClick={() => { setAutoPlay(false); setViewPly(0); }} aria-label="First">⏮</button>
            <button type="button" onClick={() => { setAutoPlay(false); setViewPly((p) => Math.max(0, p - 1)); }} aria-label="Previous">◀</button>
            <button type="button" onClick={() => { setAutoPlay(false); setViewPly((p) => Math.min(positions.length - 1, p + 1)); }} aria-label="Next">▶</button>
            <button type="button" onClick={() => { setAutoPlay(false); setViewPly(positions.length - 1); }} aria-label="Last">⏭</button>
            <span className="cb-spacer" />
            <button type="button" onClick={() => setFlipped((v) => !v)} aria-label="Flip">⇅</button>
            <button type="button" onClick={() => setMenuOpen(true)} aria-label="More">⋯</button>
          </div>
        </div>

        {/* ---------- panels ---------- */}
        <div className="an-panels">
          <div className="report-pills">
            <button className="pillbtn primary" type="button" onClick={() => runReview("quick")} disabled={reviewing}>
              <span>⚡</span> Quick Report
            </button>
            <button className="pillbtn" type="button" onClick={() => runReview("deep")} disabled={reviewing}>
              <span>⛶</span> Deep Report
            </button>
            <button
              className={`pillbtn icon${mode === "smart" ? " on" : ""}`}
              type="button"
              onClick={() => setMode((m) => (m === "smart" ? "quick" : "smart"))}
              title="Smart analysis (adaptive depth)"
            >
              ⚙
            </button>
          </div>

          <div className="engine-row">
            <span className={`engine-badge ${review ? (review.engine === "stockfish" ? "ok" : "warn") : ""}`}>
              {review
                ? review.engine === "stockfish"
                  ? "Stockfish report"
                  : "Basic engine report (fallback)"
                : "On-board read: built-in · depth 3"}
            </span>
            <span className="muted small">{mode === "smart" ? "smart depth" : mode === "deep" ? "depth 14" : "depth 10"}</span>
          </div>

          {progress && (
            <div className="card" style={{ padding: 12 }}>
              <div className="wtrack" style={{ height: 8 }}>
                <div className="wfill" style={{ width: `${(progress.done / progress.total) * 100}%`, background: "var(--accent)" }} />
              </div>
              <div className="muted small" style={{ marginTop: 4 }}>
                {reviewing ? "Analysing" : "Done"} · {progress.done}/{progress.total} positions · {mode}
                {reviewing && (
                  <button className="btn" style={{ marginLeft: 8, padding: "2px 10px" }} type="button" onClick={() => { stopRef.current = true; }}>
                    Stop
                  </button>
                )}
              </div>
            </div>
          )}

          {review && (
            <div className="stats-strip">
              {CLASSIFICATIONS.filter((c) => totals[c] > 0).map((c) => (
                <div className="stat-ico" key={c} title={CLASS_META[c].label}>
                  <span className="si-badge" style={{ background: CLASS_META[c].color }}>{CLASS_META[c].badge}</span>
                  <span className="si-n">{totals[c]}</span>
                </div>
              ))}
            </div>
          )}

          {opening && <div className="opening-bar">Opening: {opening}</div>}

          {review && (
            <button className="btn" type="button" style={{ width: "100%" }} onClick={() => setShowReport(true)}>
              Show game report
            </button>
          )}

          <div className="card">
            <h3 style={{ fontSize: 14 }}>PGN / FEN</h3>
            <textarea
              value={pgnText}
              onChange={(e) => setPgnText(e.target.value)}
              placeholder={'[Event "Game"]\n1. e4 e5 2. Nf3 Nc6 ...'}
              rows={4}
              className="pgn-area"
            />
            <div className="toolbar" style={{ marginTop: 10, marginBottom: 0 }}>
              <button className="btn primary" type="button" onClick={load}>Load</button>
              <button className="btn" type="button" onClick={() => fileRef.current?.click()}>Upload</button>
              <button className="btn" type="button" onClick={() => setPgnText(gameRef.current.pgn())}>Fill</button>
            </div>
            <input ref={fileRef} type="file" accept=".pgn,.txt" onChange={onFile} style={{ display: "none" }} />
            {recent.length > 0 && (
              <div className="rows" style={{ marginTop: 12 }}>
                {recent.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    className="row"
                    onClick={() => {
                      setPgnText(r.pgn);
                      const parsed = parseInput(r.pgn);
                      if (parsed) applyParsed(parsed, r.pgn);
                    }}
                  >
                    <div className="grow"><div className="rname">{r.label}</div></div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontSize: 14 }}>Engine lines</h3>
            <button className="btn" type="button" onClick={showLines} disabled={linesLoading} style={{ marginTop: 6 }}>
              {linesLoading ? "…" : "Show top 3 lines"}
            </button>
            {lines && lines.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {lines.map((l) => (
                  <div key={l.multipv} className="engine-line">
                    <span className="el-eval">{fmtCp(l.cp)}</span>
                    <span className="el-pv mono">{pvToSan(cur.fen, l.pv)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedReview && (
            <div className="card">
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
                  <tr><td className="muted">Phase</td><td style={{ textAlign: "right" }}>{selectedReview.phase}</td></tr>
                </tbody>
              </table>
              <p className="why">
                <b>Why?</b>{" "}
                {selectedReview.bestSan ? `Best was ${selectedReview.bestSan} (${fmtCp(selectedReview.evalBeforeCp)}). ` : ""}
                {selectedReview.san} gave away {(selectedReview.cpLoss / 100).toFixed(2)} pawns ({fmtCp(selectedReview.evalBeforeCp)} → {fmtCp(selectedReview.evalAfterCp)}).
              </p>
            </div>
          )}

          <div className="toolbar">
            <button
              className={annotate ? "btn primary" : "btn"}
              type="button"
              onClick={() => { setAnnotate((v) => !v); setPendingFrom(null); }}
            >
              {annotate ? "Annotating…" : "Annotate"}
            </button>
            <button className="btn" type="button" onClick={() => { setUserArrows([]); setUserCircles([]); setPendingFrom(null); }} disabled={!userArrows.length && !userCircles.length}>
              Clear
            </button>
          </div>
          {annotate && <p className="small muted" style={{ margin: 0 }}>Two squares = arrow · same square twice = circle · Shift = red</p>}
        </div>
      </div>

      {/* ---------- game report overlay ---------- */}
      {showReport && review && (
        <div className="report-overlay">
          <div className="report-head">
            <h3>Game Report</h3>
            <button type="button" onClick={() => setShowReport(false)} aria-label="Close">✕</button>
          </div>
          <div className="report-body">
            <GameReport review={review} currentPly={viewPly} onSelectPly={(p) => { setViewPly(p); setShowReport(false); }} />
          </div>
        </div>
      )}

      {/* ---------- more sheet ---------- */}
      {menuOpen && (
        <div className="sheet-backdrop" onClick={() => setMenuOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <span className="sheet-handle" />
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close">✕</button>
            </div>
            <button type="button" onClick={() => { setMenuOpen(false); setAutoPlay(true); }}>▶ Auto-play from here</button>
            <button type="button" onClick={() => { setMenuOpen(false); runReview(mode, true); }}>↻ Analyze again</button>
            <button type="button" onClick={() => { setMenuOpen(false); review ? setShowReport(true) : runReview(mode, true); }}>👁 Show game report</button>
            <button type="button" onClick={() => { setMenuOpen(false); copyText(gameRef.current.pgn(), "PGN"); }}>↗ Copy PGN</button>
            <button type="button" onClick={() => { setMenuOpen(false); copyText(cur.fen, "FEN"); }}>↗ Copy current FEN</button>
          </div>
        </div>
      )}
    </div>
  );
}
