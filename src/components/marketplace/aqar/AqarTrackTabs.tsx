/** تبويبات المسار: عنصر تحكم مجزّأ مضغوط (h-10) بكبسولة نشطة بنفسجية. */

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
      className="mx-[var(--page-x)] flex h-10 items-stretch gap-[var(--sp-1)] rounded-[var(--r-control)] border border-border bg-card p-1"
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
            className={`flex flex-1 items-center justify-center rounded-[10px] px-[var(--sp-3)] text-[14px] font-bold transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
