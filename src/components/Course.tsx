"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board from "@/components/Board";

export type CourseLesson = {
  type: "lesson" | "practice";
  name: string;
  explanation: string;
  fen: string;
  arrows?: { from: string; to: string }[];
  comment?: string;
};
export type CourseSection = { title: string; blurb: string; lessons: CourseLesson[] };
export type CourseLevel = { level: number; name: string; goal: string; sections: CourseSection[] };
export type CourseData = { levels: CourseLevel[] };

/** One flat, ordered list of every lesson — the lock order follows this. */
type Flat = { level: number; levelName: string; section: string; lesson: CourseLesson; key: string };

function flatten(data: CourseData): Flat[] {
  const out: Flat[] = [];
  for (const l of data.levels) {
    for (const s of l.sections) {
      for (const lesson of s.lessons) {
        out.push({
          level: l.level,
          levelName: l.name,
          section: s.title,
          lesson,
          key: `${l.level}|${s.title}|${lesson.name}`,
        });
      }
    }
  }
  return out;
}

export default function Course({
  title,
  intro,
  data,
  storageKey,
}: {
  title: string;
  intro: string;
  data: CourseData;
  storageKey: string;
}) {
  const flat = useMemo(() => flatten(data), [data]);
  const [done, setDone] = useState<Record<string, true>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setDone(raw ? (JSON.parse(raw) as Record<string, true>) : {});
    } catch {
      setDone({});
    }
  }, [storageKey]);

  useEffect(() => {
    if (!activeKey && flat.length) setActiveKey(flat[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat.length]);

  /** Index of the first lesson that is not finished — everything after it is locked. */
  const firstOpen = useMemo(() => {
    const i = flat.findIndex((f) => !done[f.key]);
    return i === -1 ? flat.length - 1 : i;
  }, [flat, done]);

  const isUnlocked = useCallback((i: number) => i <= firstOpen, [firstOpen]);

  /** Global order index of every lesson, so the lock path runs across the whole course. */
  const indexOf = useMemo(() => {
    const m = new Map<string, number>();
    flat.forEach((f, i) => m.set(f.key, i));
    return m;
  }, [flat]);

  const persist = useCallback(
    (next: Record<string, true>) => {
      setDone(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* private mode / quota */
      }
    },
    [storageKey],
  );

  const markDone = useCallback(
    (key: string) => {
      const next: Record<string, true> = { ...done, [key]: true };
      persist(next);
      const i = flat.findIndex((f) => f.key === key);
      const following = flat[i + 1];
      if (following) {
        setActiveKey(following.key);
        if (typeof window !== "undefined" && window.innerWidth < 900) {
          detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    },
    [done, flat, persist],
  );

  const active = useMemo(() => flat.find((f) => f.key === activeKey) ?? null, [flat, activeKey]);
  const activeIndex = useMemo(() => flat.findIndex((f) => f.key === activeKey), [flat, activeKey]);

  const doneCount = flat.filter((f) => done[f.key]).length;
  const pct = flat.length ? Math.round((doneCount / flat.length) * 100) : 0;

  /** Current level = the level holding the first unfinished lesson. */
  const currentLevel = useMemo(() => {
    const first = flat[firstOpen];
    const l = data.levels.find((x) => x.level === first?.level) ?? data.levels[0];
    const i = data.levels.indexOf(l);
    return { current: l, next: data.levels[i + 1] ?? null, index: i };
  }, [data, flat, firstOpen]);

  const levelDone = useCallback(
    (level: CourseLevel) => {
      const all = level.sections.flatMap((s) => s.lessons.map((ls) => `${level.level}|${s.title}|${ls.name}`));
      const got = all.filter((k) => done[k]).length;
      return { got, total: all.length, pct: all.length ? Math.round((got / all.length) * 100) : 0 };
    },
    [done],
  );

  return (
    <div className="container section">
      <h2>{title}</h2>
      <p className="sub">{intro}</p>

      {/* ---------- rank / level track ---------- */}
      <div className="rankcard">
        <div className="rank-top">
          <div>
            <span className="lbl">Current level</span>
            <strong>{currentLevel.current?.name ?? "—"}</strong>
          </div>
          <div className="right">
            <span className="lbl">Next level</span>
            <strong>{currentLevel.next?.name ?? "Complete"}</strong>
          </div>
        </div>
        <div className="ranktrack">
          <span className="chev" aria-hidden="true">‹</span>
          {data.levels.map((l, i) => {
            const ld = levelDone(l);
            const cls = ld.pct >= 100 ? "done" : i === currentLevel.index ? "cur" : "";
            return (
              <span key={l.level} className={`node ${cls}`} title={`Level ${l.level} — ${l.name} · ${ld.pct}%`}>
                {l.level}
              </span>
            );
          })}
          <span className="chev" aria-hidden="true">›</span>
        </div>
        <div className="lvl-bar">
          <span style={{ width: `${pct}%` }} />
        </div>
        <div className="muted small" style={{ marginTop: 8 }}>
          {doneCount} of {flat.length} lessons done · {pct}%
        </div>
      </div>

      <div className="two-col">
        {/* ---------- lesson detail ---------- */}
        <div ref={detailRef}>
          {active && (
            <>
              <div className="card" style={{ marginBottom: 14 }}>
                <div className="muted small">
                  Level {active.level} · {active.levelName} · {active.section}
                </div>
                <h3 style={{ fontSize: 16, marginTop: 4 }}>{active.lesson.name}</h3>
                <p style={{ marginTop: 8 }}>{active.lesson.explanation}</p>
                {active.lesson.comment && (
                  <p className="small muted" style={{ marginTop: 8 }}>
                    {active.lesson.comment}
                  </p>
                )}
                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className={`btn ${done[active.key] ? "learned" : ""}`}
                    onClick={() => markDone(active.key)}
                  >
                    {done[active.key] ? "✓ Done" : "Mark done & next"}
                  </button>
                  {activeIndex > 0 && (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setActiveKey(flat[activeIndex - 1].key)}
                    >
                      ‹ Previous
                    </button>
                  )}
                  {flat[activeIndex + 1] && isUnlocked(activeIndex + 1) && (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setActiveKey(flat[activeIndex + 1].key)}
                    >
                      Next ›
                    </button>
                  )}
                </div>
              </div>
              <Board
                fen={active.lesson.fen}
                interactive={false}
                orientation="white"
                arrows={(active.lesson.arrows ?? []).map((a) => ({ ...a, color: "#ff7900" }))}
              />
            </>
          )}
        </div>

        {/* ---------- course map ---------- */}
        <div>
          {data.levels.map((l, li) => {
            const ld = levelDone(l);
            const lockedLevel = li > currentLevel.index;
            return (
              <section className="lvl-section" key={l.level}>
                <header className="lvl-banner">
                  <span className="lvl-kicker">
                    Level {l.level}
                    {lockedLevel ? " · locked" : ""}
                  </span>
                  <span className="lvl-title">{l.name}</span>
                  <span className="lvl-blurb">{l.goal}</span>
                </header>
                <div className="lvl-body">
                  <div className="lvl-prog">
                    <span style={{ width: `${ld.pct}%` }} />
                  </div>
                  <div className="muted small lvl-meta">
                    {ld.got}/{ld.total} done
                  </div>

                  {l.sections.map((s) => (
                    <div key={s.title} style={{ marginBottom: 14 }}>
                      <div className="node-path">
                        {s.lessons.map((lesson) => {
                          const key = `${l.level}|${s.title}|${lesson.name}`;
                          const idx = indexOf.get(key) ?? 0;
                          const unlocked = isUnlocked(idx);
                          const isDone = !!done[key];
                          const isCur = key === activeKey;
                          return (
                            <button
                              key={key}
                              type="button"
                              disabled={!unlocked}
                              className={`lnode ${isDone ? "done" : ""} ${isCur ? "cur" : ""} ${
                                unlocked ? "" : "locked"
                              }`}
                              onClick={() => setActiveKey(key)}
                              title={unlocked ? lesson.name : `${lesson.name} — locked`}
                            >
                              <span className="lnode-disc" aria-hidden="true">
                                {unlocked ? (lesson.type === "practice" ? "🏋" : "📖") : "🔒"}
                              </span>
                              <span className="lnode-name">{lesson.name}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="muted small" style={{ marginTop: 6 }}>
                        {s.title} — {s.blurb}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
