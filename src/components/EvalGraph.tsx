type Props = {
  /** Evaluation per position, White's point of view, in centipawns. */
  series: number[];
  height?: number;
  /** Index of the position currently on the board (draws a marker). */
  current?: number;
  /** Click a point to jump to that move. */
  onPick?: (ply: number) => void;
};

const W = 600;
const PAD = 6;
const CLAMP = 800;

export default function EvalGraph({ series, height = 130, current, onPick }: Props) {
  if (series.length < 2) {
    return <p className="muted small" style={{ margin: 0 }}>Not enough moves to plot.</p>;
  }
  const h = height - PAD * 2;
  const n = series.length;
  const y = (cp: number) => {
    const c = Math.max(-CLAMP, Math.min(CLAMP, cp));
    return h - ((c + CLAMP) / (2 * CLAMP)) * h + PAD;
  };
  const x = (i: number) => (i / (n - 1)) * W;
  const pts = series.map((cp, i) => `${x(i)},${y(cp)}`).join(" ");
  const zero = y(0);

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!onPick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(frac * (n - 1));
    onPick(Math.max(0, Math.min(n - 1, idx)));
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      onClick={handleClick}
      style={{ display: "block", borderRadius: 8, cursor: onPick ? "pointer" : "default" }}
      role="img"
      aria-label="Evaluation graph"
    >
      <rect x="0" y={PAD} width={W} height={h} fill="#241d1a" />
      <rect x="0" y={PAD} width={W} height={Math.max(0, zero - PAD)} fill="#2f2521" />
      <line x1="0" y1={zero} x2={W} y2={zero} stroke="#4a3a33" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      <polyline points={pts} fill="none" stroke="#4a90e2" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {typeof current === "number" && current >= 0 && current < n && (
        <line
          x1={x(current)}
          y1={PAD}
          x2={x(current)}
          y2={PAD + h}
          stroke="#f2ece8"
          strokeWidth="1"
          opacity="0.55"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
