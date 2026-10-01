"use client";

import { useEffect, useMemo, useState } from "react";
import ReplayBoard from "@/components/ReplayBoard";
import type { Opening } from "@/lib/data";
import { asset } from "@/lib/data";

const PAGE = 60;

export default function OpeningsPage() {
  const [all, setAll] = useState<Opening[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [eco, setEco] = useState("all");
  const [sort, setSort] = useState<"games" | "name" | "white">("games");
  const [selected, setSelected] = useState<Opening | null>(null);
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    fetch(asset("/data/openings.json"))
      .then((r) => r.json())
      .then((d: Opening[]) => {
        setAll(d);
        setSelected(d[0]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = all.filter((o) => {
      if (eco !== "all" && o.eco !== eco) return false;
      if (q && !o.name.toLowerCase().includes(q) && !o.moves.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sort === "games") list = [...list].sort((a, b) => b.games - a.games);
    else if (sort === "white") list = [...list].sort((a, b) => b.white - a.white);
    else list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [all, query, eco, sort]);

  const shown = filtered.slice(0, limit);
  const selectedMoves = selected ? selected.moves.split(/\s+/).filter(Boolean) : [];
  const selectedSide = selected ? (selected.moves.split(/\s+/).length % 2 === 1 ? "White" : "Black") : "";

  return (
    <div className="container section">
      <h2>Openings explorer</h2>
      <p className="sub">
        {all.length.toLocaleString("en-IN")} named lines with their resulting positions. Search,
        filter, and step through any line on the board.
      </p>

      <div className="two-col">
        <div>
          {selected && (
            <>
              <div className="card" style={{ marginBottom: 14 }}>
                <h3 style={{ fontSize: 15 }}>{selected.name}</h3>
                <div className="muted small" style={{ marginTop: 4 }}>
                  {selected.eco} · {selected.games.toLocaleString("en-IN")} games · White{" "}
                  {selected.white}% / Black {selected.black}% · {selectedSide} to move at the end of
                  the line
                </div>
              </div>
              <ReplayBoard moves={selectedMoves} />
            </>
          )}
        </div>

        <div>
          <div className="toolbar">
            <input
              type="text"
              placeholder="Search by name or moves…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }}
            />
            <select value={eco} onChange={(e) => { setEco(e.target.value); setLimit(PAGE); }}>
              <option value="all">All ECO</option>
              {["A", "B", "C", "D", "E"].map((e) => (
                <option key={e} value={e}>
                  ECO {e}
                </option>
              ))}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as any)}>
              <option value="games">Most played</option>
              <option value="white">Best for White</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>

          {loading ? (
            <p className="muted"><span className="spinner" /> Loading openings…</p>
          ) : (
            <>
              <p className="muted small">{filtered.length.toLocaleString("en-IN")} results</p>
              <div className="rows">
                {shown.map((o, i) => (
                  <button
                    key={`${o.name}-${i}`}
                    type="button"
                    className={`row ${selected && selected.name === o.name && selected.moves === o.moves ? "active" : ""}`}
                    onClick={() => setSelected(o)}
                  >
                    <div className="grow">
                      <div className="rname">{o.name}</div>
                      <div className="rmeta">
                        {o.eco} · {o.games.toLocaleString("en-IN")} games · W {o.white}% / B {o.black}%
                      </div>
                    </div>
                    <span className="pill">{o.moves.split(/\s+/).length} plies</span>
                  </button>
                ))}
              </div>
              {limit < filtered.length && (
                <div className="loadmore">
                  <button className="btn" type="button" onClick={() => setLimit((l) => l + PAGE)}>
                    Load {Math.min(PAGE, filtered.length - limit)} more
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
