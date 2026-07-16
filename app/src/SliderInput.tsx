import { useEffect, useState } from "react";

interface SliderInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (value: number) => void;
}

export default function SliderInput({ label, value, min, max, step = 1, unit, onChange }: SliderInputProps) {
  const [pulsing, setPulsing] = useState(false);
  const percent = ((value - min) / (max - min)) * 100;

  useEffect(() => {
    setPulsing(true);
    const timeout = setTimeout(() => setPulsing(false), 150);
    return () => clearTimeout(timeout);
  }, [value]);

  return (
    <div className="slider-input">
      <span className="slider-input-label">{label}</span>
      <span className={`slider-input-value ${pulsing ? "pulsing" : ""}`}>
        {value}
        {unit}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ "--fill": `${percent}%` } as React.CSSProperties}
      />
    </div>
  );
}
