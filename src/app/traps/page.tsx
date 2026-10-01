"use client";

import { useMemo, useState } from "react";
import ReplayBoard from "@/components/ReplayBoard";
import { traps, type Trap } from "@/lib/data";

export default function TrapsPage() {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const map = new Map<string, Trap[]>();
    for (const t of traps) {
      if (!map.has(t.name)) map.set(t.name, []);
      map.get(t.name)!.push(t);
    }
    return Array.from(map.entries()).map(([name, variants]) => ({ name, variants }));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, query]);

  const [activeName, setActiveName] = useState(groups[0]?.name ?? "");
  const [variantIdx, setVariantIdx] = useState(0);

  const active = groups.find((g) => g.name === activeName) ?? groups[0];
  const variant = active?.variants[Math.min(variantIdx, (active?.variants.length ?? 1) - 1)];
  const moves = variant ? variant.moves.split(/\s+/).filter(Boolean) : [];
  const orientation = variant?.side === "black" ? "black" : "white";

  return (
    <div className="container section">
      <h2>Traps trainer</h2>
      <p className="sub">
        {groups.length} classic traps and mating patterns, {traps.length} variations in all. Step
        through each line to see how the trap is sprung.
      </p>

      <div className="two-col">
        <div>
          {variant && active && (
            <>
              <div className="card" style={{ marginBottom: 14 }}>
                <h3 style={{ fontSize: 15 }}>{active.name}</h3>
                <div className="muted small" style={{ marginTop: 4 }}>
                  {variant.variant} · {variant.source}
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
              <ReplayBoard moves={moves} orientation={orientation} />
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
                  <div className="rname">{g.name}</div>
                  <div className="rmeta">{g.variants.length} variation{g.variants.length > 1 ? "s" : ""}</div>
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
