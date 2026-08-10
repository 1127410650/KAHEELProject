/**
 * خط اتجاه صغير (SVG) — بلا أي مكتبة رسوم. اللون من رمز اللوحة المفعّلة.
 */
export function Sparkline({
  points,
  className = "",
}: {
  points: number[];
  className?: string;
}) {
  const values = points.length > 1 ? points : [0, ...points];
  const max = Math.max(1, ...values);
  const width = 100;
  const height = 28;
  const step = width / (values.length - 1);
  const path = values
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / max) * (height - 3) - 1.5;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `${path} L${width},${height} L0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={"h-7 w-full text-primary " + className}
      aria-hidden
    >
      <path d={area} fill="currentColor" opacity="0.12" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
