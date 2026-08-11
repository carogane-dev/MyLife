import type { CSSProperties } from "react";

export default function Skeleton({
  width,
  height = "1em",
  className = "",
  style,
}: {
  width?: string;
  height?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return <div className={`skeleton ${className}`.trim()} style={{ width, height, ...style }} />;
}
