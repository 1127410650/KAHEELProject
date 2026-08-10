/**
 * مقارنة «قبل / بعد» بمقبض سحب — تُستخدم قبل اعتماد أي نسخة محسّنة.
 * الأصل يبقى ظاهرًا على اليمين والمحسّن يُكشف بالسحب، فلا اعتماد بلا رؤية.
 */
import { useRef, useState } from "react";

export function EnhanceCompare({
  beforeUrl,
  afterUrl,
  alt,
}: {
  beforeUrl: string;
  afterUrl: string;
  alt: string;
}) {
  const [position, setPosition] = useState(50);
  const frame = useRef<HTMLDivElement | null>(null);

  const moveTo = (clientX: number) => {
    const box = frame.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const ratio = ((clientX - box.left) / box.width) * 100;
    setPosition(Math.min(100, Math.max(0, ratio)));
  };

  return (
    <div className="min-w-0">
      <div
        ref={frame}
        className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-[var(--r-card)] border border-border bg-muted"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          moveTo(event.clientX);
        }}
        onPointerMove={(event) => {
          if (event.buttons === 1) moveTo(event.clientX);
        }}
      >
        <img
          src={beforeUrl}
          alt={`${alt} — الأصل`}
          className="absolute inset-0 size-full object-cover"
          draggable={false}
        />
        <div
          className="absolute inset-y-0 start-0 overflow-hidden"
          style={{ width: `${position}%` }}
        >
          <img
            src={afterUrl}
            alt={`${alt} — بعد التحسين`}
            className="absolute inset-0 h-full w-[100vw] max-w-none object-cover"
            style={{ width: frame.current?.clientWidth ?? undefined }}
            draggable={false}
          />
        </div>
        <span
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary"
          style={{ insetInlineStart: `${position}%` }}
          aria-hidden
        />
        <span className="pointer-events-none absolute bottom-2 start-2 rounded-[var(--r-chip,12px)] bg-primary px-2 py-0.5 text-[14px] font-bold text-primary-foreground">
          ✨ بعد
        </span>
        <span className="pointer-events-none absolute bottom-2 end-2 rounded-[var(--r-chip,12px)] bg-card/90 px-2 py-0.5 text-[14px] font-bold text-foreground">
          الأصل
        </span>
      </div>
      <label className="mt-[var(--sp-2)] block text-[14px] font-bold text-muted-foreground">
        اسحب للمقارنة
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(position)}
          onChange={(event) => setPosition(Number(event.target.value))}
          className="mt-1 h-11 w-full accent-primary"
          aria-label="مقارنة قبل وبعد"
        />
      </label>
    </div>
  );
}
