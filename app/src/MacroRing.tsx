import type { ReactNode } from "react";

// Anneau de progression circulaire (SVG pur, pas de dépendance externe) —
// remplace les barres plates de l'ancienne version. circumference/offset
// calculés en JS plutôt qu'en CSS : évite tout recalcul de stroke-dasharray
// dépendant du viewport.
export default function MacroRing({
  value,
  target,
  size = 64,
  strokeWidth = 7,
  color,
  icon,
  label,
  valueLabel,
}: {
  value: number;
  target: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  icon?: ReactNode;
  label: string;
  valueLabel: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  const offset = circumference * (1 - pct);
  const center = size / 2;

  return (
    <div className="macro-ring" style={{ width: size }}>
      <div className="macro-ring-svg-wrap" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--color-border)" strokeWidth={strokeWidth} />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
          />
        </svg>
        <div className="macro-ring-center">
          {icon && <span className="macro-ring-icon" style={{ color }}>{icon}</span>}
          <span className="macro-ring-value">{valueLabel}</span>
        </div>
      </div>
      <span className="macro-ring-label">{label}</span>
    </div>
  );
}
