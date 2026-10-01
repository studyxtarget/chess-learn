"use client";

import { useEffect, useMemo, useState } from "react";
import ReplayBoard from "@/components/ReplayBoard";
import TrapTrainer from "@/components/TrapTrainer";
import { traps, type Trap } from "@/lib/data";

const STORE = "chesslearn.trapsTrained";

export default function TrapsPage() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"train" | "replay">("train");
  const [activeName, setActiveName] = useState("");
  const [variantIdx, setVariantIdx] = useState(0);
  const [trained, setTrained] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const map = new Map<string, Trap[]>();
    for (const t of traps) {
      if (!map.has(t.name)) map.set(t.name, []);
      map.get(t.name)!.push(t);
    }
    return Array.from(map.entries()).map(([name, variants]) => ({ name, variants }));
  }, []);

  useEffect(() => {
    setActiveName((g) => g || groups[0]?.name || "");
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) setTrained(new Set(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
  }, [groups]);

  function markTrained(name: string) {
    setTrained((prev) => {
      const next = new Set(prev);
      next.add(name);
      try {
        localStorage.setItem(STORE, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? groups.filter((g) => g.name.toLowerCase().includes(q)) : groups;
  }, [groups, query]);

  const active = groups.find((g) => g.name === activeName) ?? groups[0];
  const variant = active?.variants[Math.min(variantIdx, (active?.variants.length ?? 1) - 1)];
  const moves = variant ? variant.moves.split(/\s+/).filter(Boolean) : [];
  const userSide: "w" | "b" = variant?.side === "black" ? "b" : "w";
  const orientation = userSide === "b" ? "black" : "white";

  return (
    <div className="container section">
      <h2>Traps trainer</h2>
      <p className="sub">
        {groups.length} classic traps, {traps.length} variations. Train them interactively — play the
        right move, get feedback, and it counts as learned.
      </p>

      <div className="toolbar">
        <button className={mode === "train" ? "btn primary" : "btn"} type="button" onClick={() => setMode("train")}>
          Train
        </button>
        <button className={mode === "replay" ? "btn primary" : "btn"} type="button" onClick={() => setMode("replay")}>
          Replay
        </button>
        <span className="muted small" style={{ marginLeft: 6 }}>
          {trained.size} / {groups.length} learned
        </span>
      </div>

      <div className="two-col">
        <div>
          {variant && active && (
            <>
              <div className="card" style={{ marginBottom: 14 }}>
                <h3 style={{ fontSize: 15 }}>
                  {active.name} {trained.has(active.name) && <span style={{ color: "var(--accent)" }}>✓</span>}
                </h3>
                <div className="muted small" style={{ marginTop: 4 }}>
                  {variant.variant} · you play {userSide === "w" ? "White" : "Black"} · {variant.source}
                </div>
                {active.variants.length > 1 && (
                  <div className="toolbar" style={{ marginTop: 10, marginBottom: 0 }}>
                    {active.variants.map((v, i) => (
                      <button
                        key={i}
                        type="button"
                        className={i === variantIdx ? "btn primary" : "btn"}
                        onClick={() => setVariantIdx(i)}
                      >
                        {v.variant}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {mode === "train" ? (
                <TrapTrainer
                  key={`${active.name}-${variantIdx}`}
                  moves={moves}
                  userSide={userSide}
                  orientation={orientation}
                  onComplete={() => markTrained(active.name)}
                />
              ) : (
                <ReplayBoard moves={moves} orientation={orientation} />
              )}
            </>
          )}
        </div>

        <div>
          <div className="toolbar">
            <input
              type="text"
              placeholder="Search traps…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="rows">
            {filtered.map((g) => (
              <button
                key={g.name}
                type="button"
                className={`row ${g.name === activeName ? "active" : ""}`}
                onClick={() => { setActiveName(g.name); setVariantIdx(0); }}
              >
                <div className="grow">
                  <div className="rname">
                    {g.name} {trained.has(g.name) && <span style={{ color: "var(--accent)" }}>✓</span>}
                  </div>
                  <div className="rmeta">
                    {g.variants.length} variation{g.variants.length > 1 ? "s" : ""}
                  </div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && <p className="muted small">No traps match that search.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
