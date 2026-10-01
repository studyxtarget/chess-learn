import EvalGraph from "./EvalGraph";
import { CLASSIFICATIONS, CLASS_META, type Classification, type GameReview, type SideReport } from "@/lib/review";

type Props = {
  review: GameReview;
  onSelectPly: (ply: number) => void;
};

const CLEAN: Classification[] = ["book", "brilliant", "best", "excellent", "good"];

function pct(v: number | null): string {
  return v === null ? "—" : `${v.toFixed(0)}%`;
}

function Donut({ counts, title }: { counts: Record<Classification, number>; title: string }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const R = 34;
  const C = 2 * Math.PI * R;
  let off = 0;
  const segs = CLASSIFICATIONS.filter((c) => counts[c] > 0).map((c) => {
    const len = (counts[c] / total) * C;
    const seg = { c, len, off };
    off += len;
    return seg;
  });
  const clean = CLEAN.reduce((s, c) => s + counts[c], 0);

  return (
    <div style={{ textAlign: "center" }}>
      <svg viewBox="0 0 80 80" width="84" height="84" role="img" aria-label={`${title} move quality`}>
        <circle cx="40" cy="40" r={R} fill="none" stroke="#232a33" strokeWidth="11" />
        {segs.map((s) => (
          <circle
            key={s.c}
            cx="40"
            cy="40"
            r={R}
            fill="none"
            stroke={CLASS_META[s.c].color}
            strokeWidth="11"
            strokeDasharray={`${s.len} ${C - s.len}`}
            strokeDashoffset={-s.off}
            transform="rotate(-90 40 40)"
          />
        ))}
        <text x="40" y="40" textAnchor="middle" dominantBaseline="central" fontSize="16" fontWeight="700" fill="#e6e9ee">
          {Math.round((clean / total) * 100)}%
        </text>
      </svg>
      <div className="muted small" style={{ marginTop: 2 }}>{title} · clean moves</div>
    </div>
  );
}

function SideCard({ label, icon, report }: { label: string; icon: string; report: SideReport }) {
  const color = report.accuracy >= 85 ? "#6aa84f" : report.accuracy >= 70 ? "#e0c04d" : "#e0554d";
  return (
    <div className="card" style={{ padding: 13, background: "var(--bg3)" }}>
      <div className="small" style={{ fontWeight: 600, marginBottom: 8 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 27, fontWeight: 700, color, lineHeight: 1 }}>
        {report.accuracy.toFixed(1)}%
      </div>
      <div className="muted small" style={{ marginTop: 3 }}>
        accuracy · est. rating {report.estRating} · avg {(report.avgCpl / 100).toFixed(2)} CPL
      </div>
      <div className="phase-row">
        <span>Opening <b>{pct(report.phases.opening)}</b></span>
        <span>Middlegame <b>{pct(report.phases.middlegame)}</b></span>
        <span>Endgame <b>{pct(report.phases.endgame)}</b></span>
      </div>
    </div>
  );
}

export default function GameReport({ review, onSelectPly }: Props) {
  const { white, black, moves } = review;
  const used = CLASSIFICATIONS.filter(
    (c) => white.counts[c] > 0 || black.counts[c] > 0 || c === "best" || c === "blunder"
  );

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 style={{ fontSize: 15, margin: 0 }}>Game report</h3>
        <span className="muted small">
          {review.engine === "stockfish" ? "Stockfish" : "Built-in engine"} · {review.depthLabel}
        </span>
      </div>

      {review.narrative && (
        <p className="small" style={{ margin: "10px 0 0", lineHeight: 1.6, color: "#c9d1da" }}>
          {review.narrative}
        </p>
      )}

      <div className="grid cols-2" style={{ marginTop: 14, gap: 10 }}>
        <SideCard label="White" icon="♔" report={white} />
        <SideCard label="Black" icon="♚" report={black} />
      </div>

      <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 16 }}>
        <Donut counts={white.counts} title="White" />
        <Donut counts={black.counts} title="Black" />
      </div>

      <table className="quality-table">
        <thead>
          <tr className="muted small">
            <th style={{ textAlign: "left" }}>Move quality</th>
            <th style={{ textAlign: "right" }}>White</th>
            <th style={{ textAlign: "right" }}>Black</th>
          </tr>
        </thead>
        <tbody>
          {used.map((c) => (
            <tr key={c}>
              <td>
                <span style={{ color: CLASS_META[c].color, fontWeight: 700 }}>{CLASS_META[c].badge}</span>{" "}
                {CLASS_META[c].label}
              </td>
              <td style={{ textAlign: "right", fontWeight: 600 }}>{white.counts[c]}</td>
              <td style={{ textAlign: "right", fontWeight: 600 }}>{black.counts[c]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 16 }}>
        <div className="muted small" style={{ marginBottom: 6 }}>Evaluation graph (White&apos;s view)</div>
        <EvalGraph series={review.evalSeries} />
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="muted small" style={{ marginBottom: 6 }}>Key moments — biggest drops</div>
        <div className="rows">
          {[...moves]
            .sort((a, b) => b.winDrop - a.winDrop)
            .slice(0, 5)
            .filter((m) => m.winDrop > 0)
            .map((m) => (
              <button key={m.ply} type="button" className="row" onClick={() => onSelectPly(m.ply)}>
                <div className="grow">
                  <div className="rname">
                    <span style={{ color: CLASS_META[m.classification].color, fontWeight: 700 }}>
                      {CLASS_META[m.classification].badge}
                    </span>{" "}
                    {m.moveNo}
                    {m.color === "w" ? "." : "..."} {m.san}
                  </div>
                  <div className="rmeta">
                    best {m.bestSan ?? "—"} · lost {(m.cpLoss / 100).toFixed(2)} pawns
                  </div>
                </div>
                <span className="pill">-{m.winDrop.toFixed(0)}%</span>
              </button>
            ))}
          {moves.every((m) => m.winDrop === 0) && (
            <p className="muted small" style={{ margin: 0 }}>No significant drops — clean game.</p>
          )}
        </div>
      </div>
    </div>
  );
}
