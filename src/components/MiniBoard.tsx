"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { asset } from "@/lib/data";
import {
  getStoredPieceSetId,
  getStoredThemeId,
  getTheme,
  piecePath,
  subscribeSettings,
} from "@/lib/theme";

/**
 * A small, non-interactive board drawn from a FEN. Used as the thumbnail on
 * opening rows so a line is recognisable at a glance. It follows the same
 * board theme and piece set as the main board, and updates live when those
 * settings change.
 */
function parseFen(fen: string): (string | null)[][] {
  const rows = (fen.split(" ")[0] || "").split("/");
  const grid: (string | null)[][] = [];
  for (const row of rows) {
    const line: (string | null)[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < Number(ch); i++) line.push(null);
      } else {
        line.push(ch);
      }
    }
    while (line.length < 8) line.push(null);
    grid.push(line.slice(0, 8));
  }
  while (grid.length < 8) grid.push(new Array(8).fill(null));
  return grid.slice(0, 8);
}

function MiniBoard({
  fen,
  size = 48,
  className = "",
}: {
  fen: string;
  size?: number;
  className?: string;
}) {
  const [setId, setSetId] = useState("cburnett");
  const [themeId, setThemeId] = useState("wood");

  useEffect(() => {
    const sync = () => {
      setSetId(getStoredPieceSetId());
      setThemeId(getStoredThemeId());
    };
    sync();
    return subscribeSettings(sync);
  }, []);

  const theme = getTheme(themeId);
  // Parsing 64 squares on every keystroke of a search box is the main cost on the
  // list pages, so keep it tied to the FEN.
  const grid = useMemo(() => parseFen(fen), [fen]);
  const cell = size / 8;

  return (
    <div
      className={`mini ${className}`}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flex: "none",
        display: "grid",
        gridTemplateColumns: `repeat(8, ${cell}px)`,
        gridTemplateRows: `repeat(8, ${cell}px)`,
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      {grid.map((row, r) =>
        row.map((pc, f) => {
          const light = (r + f) % 2 === 0;
          return (
            <div
              key={`${r}-${f}`}
              style={{ background: light ? theme.light : theme.dark, position: "relative" }}
            >
              {pc && (
                <img
                  alt=""
                  loading="lazy"
                  decoding="async"
                  src={asset(
                    piecePath(setId, pc === pc.toUpperCase() ? "w" : "b", pc.toLowerCase()),
                  )}
                  style={{ width: "100%", height: "100%", display: "block" }}
                />
              )}
            </div>
          );
        }),
      )}
    </div>
  );
}

export default memo(MiniBoard);
