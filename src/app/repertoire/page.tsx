"use client";

import { useMemo, useState } from "react";
import ReplayBoard from "@/components/ReplayBoard";
import { repertoire, type RepertoireLine } from "@/lib/data";

export default function RepertoirePage() {
  const [side, setSide] = useState<"all" | "WHITE" | "BLACK">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<RepertoireLine>(repertoire[0]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return repertoire.filter((r) => {
      if (side !== "all" && r.side !== side) return false;
      if (q && !r.name.toLowerCase().includes(q) && !r.tags.join(" ").includes(q)) return false;
      return true;
    });
  }, [side, query]);

  const moves = selected.moves.split(/\s+/).filter(Boolean);
  const orientation = selected.side === "BLACK" ? "black" : "white";

  function WeightBars({ r }: { r: RepertoireLine }) {
    const total = r.defensive + r.neutral + r.aggressive || 1;
    const rows = [
      { label: "Defensive", v: r.defensive, c: "#4d90e0" },
      { label: "Neutral", v: r.neutral, c: "#8a8f98" },
      { label: "Aggressive", v: r.aggressive, c: "#e0554d" },
    ];
    return (
      <div className="weightbars">
        {rows.map((x) => (
          <div className="wbar" key={x.label}>
            <div className="wlbl">
              <span>{x.label}</span>
              <span>{x.v}</span>
            </div>
            <div className="wtrack">
              <div className="wfill" style={{ width: `${(x.v / total) * 100}%`, background: x.c }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="container section">
      <h2>Bot opening repertoire</h2>
      <p className="sub">
        The exact {repertoire.length} opening lines the bots are prepared to play — each with a side,
        a style weighting, tags, and a vetted maximum centipawn loss.
      </p>

      <div className="two-col">
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 15 }}>{selected.name}</h3>
            <div className="muted small" style={{ marginTop: 4 }}>
              Plays {selected.side === "WHITE" ? "White" : "Black"} · max vetted loss {selected.maxCpLoss} cp
            </div>
            <div style={{ marginTop: 8 }}>
              {selected.tags.map((t) => (
                <span className="tag" key={t} style={{ marginRight: 6 }}>{t.replace(/_/g, " ")}</span>
              ))}
            </div>
            <WeightBars r={selected} />
            <p className="small" style={{ marginTop: 12, marginBottom: 0 }}>
              <a href={selected.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                Reference source ↗
              </a>
            </p>
          </div>
          <ReplayBoard moves={moves} orientation={orientation} />
        </div>

        <div>
          <div className="toolbar">
            <input type="text" placeholder="Search lines or tags…" value={query} onChange={(e) => setQuery(e.target.value)} />
            {(["all", "WHITE", "BLACK"] as const).map((s) => (
              <button key={s} type="button" className={side === s ? "btn primary" : "btn"} onClick={() => setSide(s)}>
                {s === "all" ? "All" : s === "WHITE" ? "White" : "Black"}
              </button>
            ))}
          </div>
          <div className="rows">
            {filtered.map((r, i) => (
              <button
                key={`${r.name}-${i}`}
                type="button"
                className={`row ${selected.name === r.name ? "active" : ""}`}
                onClick={() => setSelected(r)}
              >
                <div className="grow">
                  <div className="rname">{r.name}</div>
                  <div className="rmeta">
                    {r.side === "WHITE" ? "White" : "Black"} · {r.tags.slice(0, 3).join(", ").replace(/_/g, " ")}
                  </div>
                </div>
                <span className="pill">≤ {r.maxCpLoss} cp</span>
              </button>
            ))}
            {filtered.length === 0 && <p className="muted small">No lines match.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
