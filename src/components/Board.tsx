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
};

const FILES = "abcdefgh";
const RANKS = "87654321";

export default function Board({
  fen,
  orientation = "white",
  interactive = false,
  onMove,
  lastMove,
  highlights = [],
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
                aria-label={sq}
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
