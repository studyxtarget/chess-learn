"use client";

import { Chess } from "chess.js";
import { useEffect, useMemo, useState } from "react";
import Board from "./Board";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

type Ply = { fen: string; san: string; from: string; to: string };

type Props = {
  moves: string[];
  startFen?: string;
  userSide: "w" | "b";
  orientation?: "white" | "black";
  onComplete?: () => void;
};

export default function TrapTrainer({
  moves,
  startFen = START,
  userSide,
  orientation = "white",
  onComplete,
}: Props) {
  const positions: Ply[] = useMemo(() => {
    const g = new Chess(startFen);
    const list: Ply[] = [{ fen: g.fen(), san: "", from: "", to: "" }];
    for (const san of moves) {
      try {
        const m = g.move(san);
        list.push({ fen: g.fen(), san: m.san, from: m.from, to: m.to });
      } catch {
        break;
      }
    }
    return list;
  }, [moves, startFen]);

  const [ply, setPly] = useState(0);
  const [hint, setHint] = useState(false);
  const [wrong, setWrong] = useState<string | null>(null);
  const [msg, setMsg] = useState("Your move.");
  const [done, setDone] = useState(false);

  const cur = positions[Math.min(ply, positions.length - 1)];
  const turn = useMemo(() => new Chess(cur.fen).turn(), [cur.fen]);
  const expected = positions[ply + 1];
  const finished = ply >= positions.length - 1;
  const userTurn = !done && !finished && turn === userSide;

  // Auto-play the opponent's moves.
  useEffect(() => {
    if (done || finished) return;
    if (turn === userSide) return;
    setMsg("Watching opponent…");
    const t = setTimeout(() => setPly((p) => p + 1), 650);
    return () => clearTimeout(t);
  }, [turn, userSide, done, finished]);

  // Completion.
  useEffect(() => {
    if (finished && !done) {
      setDone(true);
      setMsg("Trap completed! 🎉");
      onComplete?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  useEffect(() => {
    if (userTurn && !done) setMsg("Your move.");
  }, [userTurn, done]);

  function onMove(m: { from: string; to: string; promotion?: string }) {
    if (!userTurn || !expected) return;
    if (m.from === expected.from && m.to === expected.to) {
      setWrong(null);
      setHint(false);
      setPly((p) => p + 1);
      setMsg("✓ Correct");
    } else {
      setWrong(m.to);
      setMsg("✗ Wrong move — try again");
      setTimeout(() => setWrong(null), 1100);
    }
  }

  function restart() {
    setPly(0);
    setHint(false);
    setWrong(null);
    setDone(false);
    setMsg(new Chess(startFen).turn() === userSide ? "Your move." : "Watching opponent…");
  }

  function reveal() {
    setHint(false);
    setWrong(null);
    setPly(positions.length - 1);
    setMsg("Revealed — follow the moves to learn it.");
  }

  const markers = [
    ...(hint && expected ? [{ square: expected.from, label: "?", color: "#e0c04d" }] : []),
    ...(wrong ? [{ square: wrong, label: "✗", color: "#e0554d" }] : []),
  ];

  const lastMove = ply > 0 ? { from: positions[ply].from, to: positions[ply].to } : null;

  return (
    <div className="trainer">
      <div className={`statusbar ${done ? "" : ""}`}>
        <span className="dot-status" />
        <span>{msg}</span>
      </div>

      <Board
        fen={cur.fen}
        orientation={orientation}
        interactive={userTurn}
        onMove={onMove}
        lastMove={lastMove}
        markers={markers}
      />

      <div className="trainer-bar">
        <span className="muted small">
          You play {userSide === "w" ? "White" : "Black"} · move {Math.min(ply + 1, positions.length - 1)} /{" "}
          {positions.length - 1}
        </span>
      </div>

      <div className="replay-controls">
        <button type="button" onClick={() => { setHint(true); setMsg("Hint: move the marked piece."); }} disabled={!userTurn}>
          Hint
        </button>
        <button type="button" onClick={reveal} disabled={done}>
          Reveal
        </button>
        <button type="button" onClick={restart}>
          Restart
        </button>
      </div>
    </div>
  );
}
