import { useEffect, useState } from "react";
import { scoreBand } from "../../lib/score";
import "./ScoreRing.css";

/** Circular score gauge. Colour AND the text label carry the meaning (never colour alone). */
export default function ScoreRing({ score, size = 132, stroke = 10, showLabel = true, animate = true }) {
  const { tone, label } = scoreBand(score);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const [drawn, setDrawn] = useState(!animate);

  useEffect(() => {
    if (!animate) return undefined;
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, [animate]);

  const offset = circumference * (1 - (drawn ? Math.max(0, Math.min(100, score)) : 0) / 100);

  return (
    <div className={`score-ring tone-${tone}`} style={{ width: size, height: size }} role="img" aria-label={`ATS score ${score} out of 100: ${label}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          className="score-ring-arc"
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--tone)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="score-ring-center">
        <span className="score-ring-number" style={{ fontSize: size * 0.36 }}>{score}</span>
        {showLabel && size >= 100 && <span className="score-ring-label">{label}</span>}
      </div>
    </div>
  );
}
