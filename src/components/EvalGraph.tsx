type Props = {
  /** Evaluation per position, White's point of view, in centipawns. */
  series: number[];
  height?: number;
};

const W = 600;
const PAD = 6;
const CLAMP = 800;

export default function EvalGraph({ series, height = 130 }: Props) {
  if (series.length < 2) {
    return <p className="muted small" style={{ margin: 0 }}>Not enough moves to plot.</p>;
  }
  const h = height - PAD * 2;
  const n = series.length;
  const y = (cp: number) => {
    const c = Math.max(-CLAMP, Math.min(CLAMP, cp));
    return h - ((c + CLAMP) / (2 * CLAMP)) * h + PAD;
  };
  const pts = series.map((cp, i) => `${(i / (n - 1)) * W},${y(cp)}`).join(" ");
  const zero = y(0);

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      style={{ display: "block", borderRadius: 8 }}
      role="img"
      aria-label="Evaluation graph"
    >
      <rect x="0" y={PAD} width={W} height={h} fill="#161b22" />
      <rect x="0" y={PAD} width={W} height={Math.max(0, zero - PAD)} fill="#1c232c" />
      <line
        x1="0"
        y1={zero}
        x2={W}
        y2={zero}
        stroke="#3a4553"
        strokeWidth="1"
        strokeDasharray="4 4"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={pts}
        fill="none"
        stroke="#6aa84f"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
