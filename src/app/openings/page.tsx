"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MiniBoard from "@/components/MiniBoard";
import ReplayBoard from "@/components/ReplayBoard";
import type { Opening } from "@/lib/data";
import { asset } from "@/lib/data";
import {
  LEVELS,
  levelOf,
  openingKey,
  readProgress,
  writeProgress,
  type Level,
} from "@/lib/levels";

/** Cards shown per level before "show all". */
const STRIP = 6;
const DAILY_KEY = "chesslearn.openingDaily";
const DAILY_GOAL = { discover: 3, master: 2 };

type Daily = { date: string; discover: number; master: number };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function readDaily(): Daily {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(DAILY_KEY) : null;
    const d = raw ? (JSON.parse(raw) as Daily) : null;
    if (d && d.date === today()) return d;
  } catch {
    /* ignore */
  }
  return { date: today(), discover: 0, master: 0 };
}

function writeDaily(d: Daily): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(DAILY_KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

/** Source rows carry implausible counts (up to billions); show those as unknown. */
function fmtGames(n: number): string {
  return n > 5_000_000 ? "—" : n.toLocaleString("en-IN");
}

/** The name already starts with its ECO code; don't print it twice. */
function stripEco(name: string): string {
  return name.replace(/^[A-E]\d{2}:\s*/, "");
}

function pliesOf(o: Opening): number {
  return o.moves.split(/\s+/).filter(Boolean).length;
}

export default function OpeningsPage() {
  const [all, setAll] = useState<Opening[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [eco, setEco] = useState("all");
  const [levelFilter, setLevelFilter] = useState<number | "all">("all");
  const [selected, setSelected] = useState<Opening | null>(null);
  const [learned, setLearned] = useState<Record<string, true>>({});
  const [daily, setDaily] = useState<Daily>({ date: today(), discover: 0, master: 0 });
  const [showAll, setShowAll] = useState<Record<number, boolean>>({});
  const detailRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLearned(readProgress());
    setDaily(readDaily());
    fetch(asset("/data/openings.json"))
      .then((r) => r.json())
      .then((d: Opening[]) => {
        // Drop rows with no games at all — they render as meaningless "0 games · 0%".
        const clean = d.filter((o) => o.games > 0);
        setAll(clean);
        setSelected(clean[0] ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((o) => {
      if (eco !== "all" && o.ecoGroup !== eco) return false;
      if (levelFilter !== "all" && levelOf(pliesOf(o)).n !== levelFilter) return false;
      if (q && !o.name.toLowerCase().includes(q) && !o.moves.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [all, query, eco, levelFilter]);

  const byLevel = useMemo(() => {
    const known = (n: number) => (n > 5_000_000 ? -1 : n);
    const map: Record<number, Opening[]> = {};
    for (const o of filtered) {
      const n = levelOf(pliesOf(o)).n;
      (map[n] ||= []).push(o);
    }
    for (const k of Object.keys(map)) map[Number(k)].sort((a, b) => known(b.games) - known(a.games));
    return map;
  }, [filtered]);

  /** Learned / total counts for every level. */
  const totals = useMemo(() => {
    const t: Record<number, { total: number; done: number }> = {};
    for (const o of all) {
      const n = levelOf(pliesOf(o)).n;
      t[n] ||= { total: 0, done: 0 };
      t[n].total += 1;
      if (learned[openingKey(o.name, o.moves)]) t[n].done += 1;
    }
    return t;
  }, [all, learned]);

  const currentLevel: Level = useMemo(() => {
    // Before the data arrives there is nothing learned, so start at level 1
    // rather than falling through to the last level (which read as "Master").
    if (!all.length) return LEVELS[0];
    for (const l of LEVELS) {
      const t = totals[l.n];
      if (t && t.done < t.total) return l;
    }
    return LEVELS[LEVELS.length - 1];
  }, [all.length, totals]);

  const nextLevel: Level | null = useMemo(() => {
    const i = LEVELS.findIndex((l) => l.n === currentLevel.n);
    return LEVELS[i + 1] ?? null;
  }, [currentLevel]);

  const overall = useMemo(() => {
    const total = all.length;
    const done = all.reduce((a, o) => a + (learned[openingKey(o.name, o.moves)] ? 1 : 0), 0);
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [all, learned]);

  const bumpDaily = useCallback((field: "discover" | "master") => {
    setDaily((d) => {
      const base = d.date === today() ? d : { date: today(), discover: 0, master: 0 };
      const next = { ...base, [field]: base[field] + 1 };
      writeDaily(next);
      return next;
    });
  }, []);

  const openLine = useCallback(
    (o: Opening) => {
      const first = !learned[openingKey(o.name, o.moves)];
      setSelected(o);
      if (first) bumpDaily("discover");
      if (typeof window !== "undefined" && window.innerWidth < 900) {
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [learned, bumpDaily],
  );

  const isLearned = useCallback(
    (o: Opening) => Boolean(learned[openingKey(o.name, o.moves)]),
    [learned],
  );

  const toggleLearned = useCallback(
    (o: Opening) => {
      const k = openingKey(o.name, o.moves);
      setLearned((prev) => {
        const next = { ...prev };
        if (next[k]) delete next[k];
        else {
          next[k] = true;
          bumpDaily("master");
        }
        writeProgress(next);
        return next;
      });
    },
    [bumpDaily],
  );

  const selectedMoves = selected ? selected.moves.split(/\s+/).filter(Boolean) : [];
  // Even plies => White is to move next; odd => Black.
  const selectedSide = selected
    ? selectedMoves.length % 2 === 0
      ? "White"
      : "Black"
    : "";

  return (
    <div className="container section">
      <h2>Openings</h2>
      <p className="sub">
        A level-by-level course over {all.length ? all.length.toLocaleString("en-IN") : "4,700+"}{" "}
        named lines. Short mainlines first, deep theory last — step through any line on the board and
        mark it learned as you go.
      </p>

      {/* ---------- rank / level track ---------- */}
      <div className="rankcard">
        <div className="rank-top">
          <div>
            <span className="lbl">Current level</span>
            <strong>{currentLevel.name}</strong>
          </div>
          <div className="right">
            <span className="lbl">Next level</span>
            <strong>{nextLevel ? nextLevel.name : "Complete"}</strong>
          </div>
        </div>
        <div className="ranktrack">
          <span className="chev" aria-hidden="true">‹</span>
          {LEVELS.map((l) => {
            const t = totals[l.n];
            const pct = t && t.total ? Math.round((t.done / t.total) * 100) : 0;
            const state = pct >= 100 ? "done" : l.n === currentLevel.n ? "cur" : "";
            return (
              <button
                key={l.n}
                type="button"
                className={`node ${state}`}
                title={`Level ${l.n} · ${l.name} — ${pct}% learned`}
                onClick={() => setLevelFilter(levelFilter === l.n ? "all" : l.n)}
              >
                {l.n}
              </button>
            );
          })}
          <span className="chev" aria-hidden="true">›</span>
        </div>
        <div className="lvl-bar">
          <span style={{ width: `${overall.pct}%` }} />
        </div>
        <div className="muted small" style={{ marginTop: 8 }}>
          {all.length
            ? `${overall.done.toLocaleString("en-IN")} of ${overall.total.toLocaleString(
                "en-IN",
              )} lines learned · ${overall.pct}%`
            : "Loading your progress…"}
        </div>
      </div>

      {/* ---------- today's workout ---------- */}
      <div className="workout">
        <div className="workout-head">
          <strong>Today&apos;s workout</strong>
          <span className="checker" aria-hidden="true" />
        </div>
        {(
          [
            { field: "discover" as const, label: "Discover new lines" },
            { field: "master" as const, label: "Master lines" },
          ]
        ).map(({ field, label }) => {
          const got = Math.min(daily[field], DAILY_GOAL[field]);
          const pct = Math.round((got / DAILY_GOAL[field]) * 100);
          return (
            <div className="workout-row" key={field}>
              <span className={`wbox ${got >= DAILY_GOAL[field] ? "tick" : ""}`} aria-hidden="true">
                {got >= DAILY_GOAL[field] ? "✓" : ""}
              </span>
              <span className="wlabel">{label}</span>
              <span className="wbar">
                <span style={{ width: `${pct}%` }} />
              </span>
              <span className="wcount">
                {got}/{DAILY_GOAL[field]}
              </span>
            </div>
          );
        })}
        <div className="workout-foot">
          Focus: {currentLevel.name} — {currentLevel.blurb}
        </div>
      </div>

      {/* ---------- toolbar ---------- */}
      <div className="toolbar">
        <input
          type="text"
          placeholder="Search by name or moves…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={eco} onChange={(e) => setEco(e.target.value)}>
          <option value="all">All ECO</option>
          {["A", "B", "C", "D", "E"].map((e) => (
            <option key={e} value={e}>
              ECO {e}
            </option>
          ))}
        </select>
        <select
          value={levelFilter}
          onChange={(e) =>
            setLevelFilter(e.target.value === "all" ? "all" : Number(e.target.value))
          }
        >
          <option value="all">All levels</option>
          {LEVELS.map((l) => (
            <option key={l.n} value={l.n}>
              Level {l.n} — {l.name}
            </option>
          ))}
        </select>
      </div>

      <div className="two-col">
        {/* ---------- detail ---------- */}
        <div ref={detailRef}>
          {selected && (
            <>
              <div className="card" style={{ marginBottom: 14 }}>
                <h3 style={{ fontSize: 15 }}>{stripEco(selected.name)}</h3>
                <div className="muted small" style={{ marginTop: 4 }}>
                  {selected.eco} · Level {levelOf(pliesOf(selected)).n} (
                  {levelOf(pliesOf(selected)).name}) · {fmtGames(selected.games)} games · White{" "}
                  {selected.white}% / Black {selected.black}% · {selectedSide} to move at the end of
                  the line
                </div>
                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className={`btn ${isLearned(selected) ? "learned" : ""}`}
                    onClick={() => toggleLearned(selected)}
                  >
                    {isLearned(selected) ? "✓ Learned" : "Mark as learned"}
                  </button>
                </div>
              </div>
              <ReplayBoard moves={selectedMoves} />
            </>
          )}
        </div>

        {/* ---------- level sections ---------- */}
        <div>
          {loading ? (
            <p className="muted">
              <span className="spinner" /> Loading openings…
            </p>
          ) : (
            <>
              <p className="muted small">
                {filtered.length.toLocaleString("en-IN")} lines
                {levelFilter !== "all" ? ` in level ${levelFilter}` : ""}
              </p>

              {LEVELS.filter((l) => (byLevel[l.n]?.length ?? 0) > 0).map((l) => {
                const items = byLevel[l.n] ?? [];
                const t = totals[l.n] ?? { total: items.length, done: 0 };
                const pct = t.total ? Math.round((t.done / t.total) * 100) : 0;
                const expanded = showAll[l.n];
                const visible = expanded ? items.slice(0, 200) : items.slice(0, STRIP);
                return (
                  <section className="lvl-section" key={l.n}>
                    <header className="lvl-banner">
                      <span className="lvl-kicker">Level {l.n}</span>
                      <span className="lvl-title">{l.name}</span>
                      <span className="lvl-blurb">{l.blurb}</span>
                    </header>
                    <div className="lvl-body">
                      <div className="lvl-prog">
                        <span style={{ width: `${pct}%` }} />
                      </div>
                      <div className="muted small lvl-meta">
                        {t.done.toLocaleString("en-IN")}/{t.total.toLocaleString("en-IN")} learned ·{" "}
                        {items.length.toLocaleString("en-IN")} lines shown
                      </div>

                      <div className="cards-strip">
                        {visible.map((o, i) => (
                          <button
                            type="button"
                            key={`${o.name}-${i}`}
                            title={stripEco(o.name)}
                            className={`op-card ${
                              selected && selected.name === o.name && selected.moves === o.moves
                                ? "active"
                                : ""
                            }`}
                            onClick={() => openLine(o)}
                          >
                            <MiniBoard fen={o.fen} size={78} />
                            <span className="op-card-name">{stripEco(o.name)}</span>
                            <span className="op-card-meta">
                              {o.eco} · {pliesOf(o)} plies
                            </span>
                            {isLearned(o) && (
                              <span className="op-badge" title="Learned">
                                ★
                              </span>
                            )}
                          </button>
                        ))}
                      </div>

                      {!expanded && items.length > STRIP && (
                        <div className="loadmore">
                          <button
                            className="btn"
                            type="button"
                            onClick={() => setShowAll((s) => ({ ...s, [l.n]: true }))}
                          >
                            Show all {items.length.toLocaleString("en-IN")} in level {l.n}
                          </button>
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}

              {filtered.length === 0 && (
                <p className="muted">No lines match that search.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
