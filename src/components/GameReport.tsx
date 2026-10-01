import EvalGraph from "./EvalGraph";
import { CLASSIFICATIONS, CLASS_META, type GameReview } from "@/lib/review";

type Props = {
  review: GameReview;
  onSelectPly: (ply: number) => void;
};

function Accuracy({ value }: { value: number }) {
  const color = value >= 85 ? "#6aa84f" : value >= 70 ? "#e0c04d" : "#e0554d";
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 30, fontWeight: 700, color }}>{value.toFixed(1)}%</div>
      <div className="muted small">accuracy</div>
    </div>
  );
}

export default function GameReport({ review, onSelectPly }: Props) {
  const { white, black, moves } = review;
  const rows = CLASSIFICATIONS.filter((c) => c !== "best" || true);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 style={{ fontSize: 15, margin: 0 }}>Game report</h3>
        <span className="muted small">
          {review.engine === "stockfish" ? `Stockfish · depth ${review.depth}` : `Built-in engine · depth ${review.depth}`}
        </span>
      </div>

      <div className="grid cols-2" style={{ marginTop: 14, gap: 10 }}>
        <div className="card" style={{ padding: 12, background: "var(--bg3)" }}>
          <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>♔ White</div>
          <Accuracy value={white.accuracy} />
        </div>
        <div className="card" style={{ padding: 12, background: "var(--bg3)" }}>
          <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>♚ Black</div>
          <Accuracy value={black.accuracy} />
        </div>
      </div>

      <table style={{ width: "100%", marginTop: 14, borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr className="muted small">
            <th style={{ textAlign: "left", padding: "4px 0" }}>Move quality</th>
            <th style={{ textAlign: "right" }}>White</th>
            <th style={{ textAlign: "right" }}>Black</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c}>
              <td style={{ padding: "3px 0" }}>
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
              <button
                key={m.ply}
                type="button"
                className="row"
                onClick={() => onSelectPly(m.ply)}
              >
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
