"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import Board from "@/components/Board";
import { botMove } from "@/lib/engine";
import { bots, countryFlag, styleLabel, styleColor, asset, type Bot } from "@/lib/data";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export default function PlayPage() {
  const [playerSide, setPlayerSide] = useState<"w" | "b">("w");
  const [filter, setFilter] = useState<"all" | "agg" | "def" | "neutral">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(START);
  const [history, setHistory] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [resigned, setResigned] = useState(false);

  const botSide: "WHITE" | "BLACK" = playerSide === "w" ? "BLACK" : "WHITE";

  // Only offer bots that have a prepared repertoire for the side they will play.
  const available = useMemo(
    () => bots.filter((b) => b.side === botSide && (filter === "all" || b.style === filter)),
    [botSide, filter]
  );
  const selectedBot: Bot = available.find((b) => b.id === selectedId) ?? available[0] ?? bots[0];

  const orientation: "white" | "black" = flipped
    ? playerSide === "w"
      ? "black"
      : "white"
    : playerSide === "w"
    ? "white"
    : "black";

  function sync() {
    const g = gameRef.current;
    setFen(g.fen());
    setHistory(g.history() as string[]);
    const h = g.history({ verbose: true }) as any[];
    setLastMove(h.length ? { from: h[h.length - 1].from, to: h[h.length - 1].to } : null);
  }

  function reset() {
    gameRef.current = new Chess();
    setResigned(false);
    setThinking(false);
    sync();
  }

  function chooseSide(side: "w" | "b") {
    setPlayerSide(side);
    setSelectedId(null);
    reset();
  }

  // Bot replies whenever it is the bot's turn.
  useEffect(() => {
    const g = gameRef.current;
    if (resigned || g.isGameOver()) return;
    if (g.turn() === playerSide) return;
    let cancelled = false;
    setThinking(true);
    const t = setTimeout(() => {
      const m = botMove(g.fen(), g.history() as string[], selectedBot);
      if (cancelled) return;
      if (m) {
        try {
          g.move({ from: m.from, to: m.to, promotion: m.promotion });
        } catch {
          /* ignore */
        }
        sync();
      }
      setThinking(false);
    }, 420);
    return () => {
      cancelled = true;
      clearTimeout(t);
      setThinking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, playerSide, selectedBot, resigned]);

  function onPlayerMove(m: { from: string; to: string; promotion?: string }) {
    const g = gameRef.current;
    try {
      g.move({ from: m.from, to: m.to, promotion: m.promotion || "q" });
    } catch {
      return;
    }
    sync();
  }

  function undo() {
    const g = gameRef.current;
    if (history.length === 0) return;
    g.undo();
    if (g.turn() !== playerSide && g.history().length > 0) g.undo();
    sync();
  }

  const over = gameRef.current.isGameOver() || resigned;
  const turn = gameRef.current.turn();
  const playerTurn = !over && turn === playerSide && !thinking;

  let status: string;
  if (resigned) status = "You resigned. The bot wins.";
  else if (gameRef.current.isCheckmate())
    status = turn === playerSide ? "Checkmate — the bot wins." : "Checkmate — you win!";
  else if (gameRef.current.isDraw() || gameRef.current.isStalemate()) status = "Draw — game over.";
  else if (thinking) status = `${selectedBot.name} is thinking…`;
  else if (playerTurn) status = gameRef.current.isCheck() ? "Your move — you're in check!" : "Your move.";
  else status = `${selectedBot.name} to move.`;

  return (
    <div className="container section">
      <h2>Play vs Bot</h2>
      <p className="sub">
        Pick a side, then choose an opponent prepared for the other side. Each bot opens with its own
        repertoire line, then plays with a personality: attackers push, defenders hold.
      </p>

      <div className="toolbar">
        <span className="muted small">You play:</span>
        <button className={playerSide === "w" ? "btn primary" : "btn"} type="button" onClick={() => chooseSide("w")}>
          ♔ White
        </button>
        <button className={playerSide === "b" ? "btn primary" : "btn"} type="button" onClick={() => chooseSide("b")}>
          ♚ Black
        </button>
        <span className="muted small" style={{ marginLeft: 8 }}>
          Opponent is prepared as <strong style={{ color: "var(--text)" }}>{botSide === "WHITE" ? "White" : "Black"}</strong>
        </span>
      </div>

      <div className="two-col">
        <div>
          <div className={`statusbar ${over ? "over" : ""}`}>
            <span className="dot-status" />
            <span>{status}</span>
          </div>
          <Board
            fen={fen}
            orientation={orientation}
            interactive={playerTurn}
            onMove={onPlayerMove}
            lastMove={lastMove}
          />
          <div className="toolbar" style={{ marginTop: 12 }}>
            <button className="btn primary" type="button" onClick={reset}>
              New game
            </button>
            <button className="btn" type="button" onClick={undo} disabled={history.length === 0}>
              Undo
            </button>
            <button className="btn" type="button" onClick={() => setFlipped((v) => !v)}>
              Flip board
            </button>
            <button className="btn" type="button" onClick={() => setResigned(true)} disabled={over}>
              Resign
            </button>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <h3 style={{ fontSize: 14 }}>Moves</h3>
            <div className="movelist">
              {history.length === 0 && <span className="muted small">No moves yet.</span>}
              {history.map((san, i) => (
                <span key={i} className="mv">
                  {i % 2 === 0 && <span className="mvno">{Math.floor(i / 2) + 1}.</span>}
                  {san}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset(`/bots/${selectedBot.file}`)}
                alt={selectedBot.name}
                style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--bg3)" }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>
                  {selectedBot.name} {countryFlag(selectedBot.country)}
                </div>
                <div className="muted small">
                  {selectedBot.rating} Elo · plays {selectedBot.side === "WHITE" ? "White" : "Black"}
                </div>
                <span
                  className="pill"
                  style={{ color: styleColor[selectedBot.style], borderColor: styleColor[selectedBot.style], marginTop: 6 }}
                >
                  {styleLabel[selectedBot.style]}
                </span>
              </div>
            </div>
            {selectedBot.line && (
              <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
                Prepared opening: <strong style={{ color: "var(--text)" }}>{selectedBot.line}</strong>
                {selectedBot.tags.length > 0 && <> · {selectedBot.tags.join(", ").replace(/_/g, " ")}</>}
              </p>
            )}
          </div>

          <div className="toolbar">
            <span className="muted small">Style:</span>
            {(["all", "agg", "def", "neutral"] as const).map((f) => (
              <button key={f} className={filter === f ? "btn primary" : "btn"} type="button" onClick={() => setFilter(f)}>
                {f === "all" ? "All" : styleLabel[f]}
              </button>
            ))}
          </div>

          <div className="grid cols-3">
            {available.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`botcard ${b.id === selectedBot.id ? "active" : ""}`}
                onClick={() => {
                  setSelectedId(b.id);
                  reset();
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset(`/bots/${b.file}`)} alt={b.name} />
                <div className="bname">
                  {b.name} {countryFlag(b.country)}
                </div>
                <div className="brating">{b.rating} Elo</div>
              </button>
            ))}
            {available.length === 0 && <p className="muted small">No bots for this style.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
