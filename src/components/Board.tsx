"use client";

import { Chess } from "chess.js";
import { useMemo, useState } from "react";
import { asset } from "@/lib/data";

export type BoardMove = { from: string; to: string; promotion?: string };

type Props = {
  fen: string;
  orientation?: "white" | "black";
  interactive?: boolean;
  onMove?: (m: BoardMove) => void;
  lastMove?: { from: string; to: string } | null;
  highlights?: string[];
  arrows?: { from: string; to: string; color?: string }[];
  markers?: { square: string; label: string; color?: string }[];
};

const FILES = "abcdefgh";
const RANKS = "87654321";
const PIECE_NAME: Record<string, string> = {
  p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king",
};

export default function Board({
  fen,
  orientation = "white",
  interactive = false,
  onMove,
  lastMove,
  highlights = [],
  arrows = [],
  markers = [],
}: Props) {
  const game = useMemo(() => new Chess(fen), [fen]);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<BoardMove | null>(null);

  const board = game.board();
  const turn = game.turn();

  const targets = useMemo(() => {
    if (!selected) return new Set<string>();
    const ms = game.moves({ square: selected as any, verbose: true }) as any[];
    return new Set<string>(ms.map((m) => m.to));
  }, [selected, game]);

  const checkSquare = useMemo(() => {
    if (!game.isCheck()) return null;
    for (const row of board) for (const sq of row) {
      if (sq && sq.type === "k" && sq.color === turn) return sq.square;
    }
    return null;
  }, [board, game, turn]);

  const files: string[] = orientation === "white" ? [...FILES] : [...FILES].reverse();
  const ranks: string[] = orientation === "white" ? [...RANKS] : [...RANKS].reverse();

  function squareColor(sq: string): "light" | "dark" {
    const f = FILES.indexOf(sq[0]);
    const r = parseInt(sq[1], 10);
    return (f + r) % 2 === 0 ? "dark" : "light";
  }

  // Centre of a square in board units (0..8), respecting orientation.
  function center(sq: string): [number, number] {
    const f = FILES.indexOf(sq[0]);
    const r = parseInt(sq[1], 10);
    const col = orientation === "white" ? f : 7 - f;
    const row = orientation === "white" ? 8 - r : r - 1;
    return [col + 0.5, row + 0.5];
  }

  function pieceAt(sq: string) {
    const f = FILES.indexOf(sq[0]);
    const r = 8 - parseInt(sq[1], 10);
    return board[r][f];
  }

  function click(sq: string) {
    if (!interactive || pending) return;
    const piece = pieceAt(sq);
    if (selected && targets.has(sq)) {
      const isPromo = game.moves({ square: selected as any, verbose: true }).some(
        (m: any) => m.to === sq && m.promotion
      );
      if (isPromo) {
        setPending({ from: selected, to: sq });
        setSelected(null);
        return;
      }
      onMove?.({ from: selected, to: sq });
      setSelected(null);
      return;
    }
    if (piece && piece.color === turn) {
      setSelected(sq);
    } else {
      setSelected(null);
    }
  }

  return (
    <div className="board-wrap">
      <div className="board">
        {ranks.map((rank) =>
          files.map((file) => {
            const sq = `${file}${rank}`;
            const piece = pieceAt(sq);
            const color = squareColor(sq);
            const isSel = selected === sq;
            const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq);
            const isTarget = targets.has(sq);
            const isCheck = checkSquare === sq;
            const isHl = highlights.includes(sq);
            return (
              <button
                key={sq}
                className={[
                  "sq",
                  color,
                  isSel ? "sel" : "",
                  isLast ? "last" : "",
                  isCheck ? "check" : "",
                  isHl ? "hl" : "",
                  interactive ? "clickable" : "",
                ].join(" ")}
                onClick={() => click(sq)}
                aria-label={
                  piece
                    ? `${piece.color === "w" ? "White" : "Black"} ${PIECE_NAME[piece.type]} on ${sq}`
                    : `Empty square ${sq}`
                }
                type="button"
              >
                {piece && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="piece"
                    src={asset(`/pieces/cburnett/${piece.color}${piece.type}.svg`)}
                    alt={`${piece.color === "w" ? "white" : "black"} ${piece.type}`}
                    draggable={false}
                  />
                )}
                {isTarget && !piece && <span className="dot" />}
                {isTarget && piece && <span className="ring" />}
                {file === files[0] && <span className="rank-label">{rank}</span>}
                {rank === ranks[ranks.length - 1] && <span className="file-label">{file}</span>}
              </button>
            );
          })
        )}
      </div>

      {(arrows.length > 0 || markers.length > 0) && (
        <svg className="board-overlay" viewBox="0 0 8 8" aria-hidden="true">
          {arrows.map((a, i) => {
            const [x1, y1] = center(a.from);
            const [x2, y2] = center(a.to);
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.hypot(dx, dy) || 1;
            const ux = dx / len;
            const uy = dy / len;
            const sx = x1 + ux * 0.3;
            const sy = y1 + uy * 0.3;
            const ex = x2 - ux * 0.32;
            const ey = y2 - uy * 0.32;
            const hw = 0.21;
            const hl = 0.28;
            const px = -uy;
            const py = ux;
            const col = a.color ?? "#6aa84f";
            return (
              <g key={i} opacity="0.9">
                <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={col} strokeWidth="0.085" strokeLinecap="round" />
                <polygon
                  points={`${ex},${ey} ${ex - ux * hl + px * hw},${ey - uy * hl + py * hw} ${ex - ux * hl - px * hw},${ey - uy * hl - py * hw}`}
                  fill={col}
                />
              </g>
            );
          })}
          {markers.map((mk, i) => {
            const [cx, cy] = center(mk.square);
            const col = mk.color ?? "#e0554d";
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r="0.31" fill={col} opacity="0.94" />
                <text
                  x={cx}
                  y={cy}
                  fontSize="0.42"
                  fontWeight="700"
                  fill="#fff"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {mk.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {pending && (
        <div className="promo-overlay">
          <div className="promo-box">
            <p>Promote to</p>
            <div className="promo-row">
              {["q", "r", "b", "n"].map((pr) => (
                <button
                  key={pr}
                  type="button"
                  onClick={() => {
                    onMove?.({ ...pending, promotion: pr });
                    setPending(null);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset(`/pieces/cburnett/${turn}${pr}.svg`)}
                    alt={pr}
                    draggable={false}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
