"use client";

import { Chess } from "chess.js";
import { useEffect, useMemo, useState } from "react";
import Board from "./Board";

type Props = {
  moves: string[]; // SAN, mainline only
  startFen?: string;
  orientation?: "white" | "black";
  autoPlay?: boolean;
};

export default function ReplayBoard({
  moves,
  startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  orientation = "white",
  autoPlay = false,
}: Props) {
  const [ply, setPly] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);

  // Recompute every position once per line.
  const positions = useMemo(() => {
    const game = new Chess(startFen);
    const list: { fen: string; san: string; from: string; to: string }[] = [
      { fen: game.fen(), san: "", from: "", to: "" },
    ];
    for (const san of moves) {
      try {
        const m = game.move(san);
        list.push({ fen: game.fen(), san: m.san, from: m.from, to: m.to });
      } catch {
        break;
      }
    }
    return list;
  }, [moves, startFen]);

  useEffect(() => {
    setPly(0);
    setPlaying(autoPlay);
  }, [moves, autoPlay]);

  useEffect(() => {
    if (!playing) return;
    if (ply >= positions.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setPly((p) => Math.min(p + 1, positions.length - 1)), 700);
    return () => clearTimeout(t);
  }, [playing, ply, positions.length]);

  const cur = positions[ply];
  const last = ply > 0 ? { from: positions[ply].from, to: positions[ply].to } : null;

  return (
    <div className="replay">
      <Board
        fen={cur.fen}
        orientation={orientation}
        lastMove={last}
      />
      <div className="replay-controls">
        <button type="button" onClick={() => { setPlaying(false); setPly(0); }} aria-label="Start">⏮</button>
        <button type="button" onClick={() => { setPlaying(false); setPly((p) => Math.max(0, p - 1)); }} aria-label="Previous">◀</button>
        <button type="button" onClick={() => setPlaying((v) => !v)} aria-label="Play">
          {playing ? "❚❚" : "▶"}
        </button>
        <button type="button" onClick={() => { setPlaying(false); setPly((p) => Math.min(positions.length - 1, p + 1)); }} aria-label="Next">▶</button>
        <button type="button" onClick={() => { setPlaying(false); setPly(positions.length - 1); }} aria-label="End">⏭</button>
      </div>
      <div className="movelist">
        {positions.slice(1).map((p, i) => (
          <button
            key={i}
            type="button"
            className={ply === i + 1 ? "mv active" : "mv"}
            onClick={() => { setPlaying(false); setPly(i + 1); }}
          >
            {i % 2 === 0 && <span className="mvno">{Math.floor(i / 2) + 1}.</span>}
            {p.san}
          </button>
        ))}
      </div>
    </div>
  );
}
