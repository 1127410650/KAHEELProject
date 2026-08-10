/** تبويبات المسار: يومي / طويل / بيع بكبسولة بنفسجية للنشط. */

import { AQAR_TRACKS, type AqarTrack } from "@/lib/mkt-aqar";

export function AqarTrackTabs({
  track,
  onChange,
}: {
  track: AqarTrack;
  onChange: (track: AqarTrack) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="نوع العرض"
      className="mx-4 flex gap-1 rounded-full border border-border bg-card p-1"
    >
      {AQAR_TRACKS.map((item) => {
        const active = item.key === track;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={`flex-1 rounded-full px-3 py-2 text-desc font-bold transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={{ minHeight: 44 }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
