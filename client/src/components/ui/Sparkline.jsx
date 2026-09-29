/** Tiny score-history line on a fixed 0-100 scale (so a flat line really means flat). */
export default function Sparkline({ values, width = 240, height = 56 }) {
  if (!values || values.length < 2) return null;
  const pad = 6;
  const step = (width - pad * 2) / (values.length - 1);
  const y = (v) => pad + (1 - Math.max(0, Math.min(100, v)) / 100) * (height - pad * 2);
  const points = values.map((v, i) => [pad + i * step, y(v)]);
  const line = points.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
  const area = `${line} L${points[points.length - 1][0].toFixed(1)} ${height - pad} L${pad} ${height - pad} Z`;
  const [lx, ly] = points[points.length - 1];

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`Score history: ${values.join(", ")}`} style={{ maxWidth: width, height }}>
      <path d={area} fill="var(--primary)" opacity="0.1" />
      <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r="3.5" fill="var(--primary)" />
    </svg>
  );
}
