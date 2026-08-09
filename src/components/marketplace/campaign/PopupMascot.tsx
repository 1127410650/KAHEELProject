/**
 * Popup mascots — four tiny inline SVG characters used by the compact ad card.
 *
 * Inline vectors on purpose: each scene is a few hundred bytes of markup, so the
 * popup adds no network request, no decode cost and no layout shift. Motion is
 * pure CSS and disabled under `prefers-reduced-motion`.
 */
export type MascotKind = "moto" | "lounge" | "wave" | "peek";

export const MASCOT_KINDS: MascotKind[] = ["moto", "lounge", "wave", "peek"];

const SKIN = "#f4c9a3";
const HAIR = "#240046";
const BODY = "#7b2cbf";
const BODY_DARK = "#5a189a";
const ACCENT = "#c77dff";

function Frame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      role="presentation"
      aria-hidden="true"
      className={`size-full ${className ?? ""}`}
    >
      <circle cx="48" cy="48" r="46" fill={ACCENT} opacity="0.16" />
      {children}
    </svg>
  );
}

/** Rider leaning forward on a scooter, with speed lines behind him. */
function Moto() {
  return (
    <Frame className="animate-[kaheel-mascot-ride_1.4s_ease-in-out_infinite] motion-reduce:animate-none">
      <g stroke={ACCENT} strokeWidth="3" strokeLinecap="round" opacity="0.85">
        <path d="M8 40h14M6 52h18M12 64h12" />
      </g>
      <circle cx="36" cy="72" r="9" fill={HAIR} />
      <circle cx="36" cy="72" r="3.4" fill={ACCENT} />
      <circle cx="76" cy="72" r="9" fill={HAIR} />
      <circle cx="76" cy="72" r="3.4" fill={ACCENT} />
      <path d="M34 68h40l-6-14H44z" fill={BODY} />
      <path d="M70 54l10-10" stroke={BODY_DARK} strokeWidth="5" strokeLinecap="round" />
      <path d="M46 52c2-12 8-18 16-18l8 4-6 8-8 2-4 6z" fill={BODY_DARK} />
      <circle cx="64" cy="28" r="10" fill={SKIN} />
      <path d="M54 26a10 10 0 0 1 20 0z" fill={HAIR} />
    </Frame>
  );
}

/** Relaxed character lying back with one leg crossed over the other. */
function Lounge() {
  return (
    <Frame className="animate-[kaheel-mascot-breathe_2.6s_ease-in-out_infinite] motion-reduce:animate-none">
      <rect x="14" y="60" width="68" height="14" rx="7" fill={BODY_DARK} />
      <path d="M22 60c8-8 20-10 30-8l22 4-2 10H24z" fill={BODY} />
      <path d="M52 54l16-10 4 6-14 10z" fill={BODY} />
      <path d="M60 46l14-12 5 5-13 13z" fill={BODY_DARK} />
      <circle cx="30" cy="46" r="11" fill={SKIN} />
      <path d="M19 44a11 11 0 0 1 22 0z" fill={HAIR} />
      <path d="M25 47h2M33 47h2" stroke={HAIR} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M27 52c2 2 5 2 7 0" stroke={HAIR} strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </Frame>
  );
}

/** Character waving goodbye. */
function Wave() {
  return (
    <Frame>
      <path d="M30 88V60a18 18 0 0 1 36 0v28z" fill={BODY} />
      <circle cx="48" cy="34" r="14" fill={SKIN} />
      <path d="M34 32a14 14 0 0 1 28 0z" fill={HAIR} />
      <path d="M42 34h2.5M53 34h2.5" stroke={HAIR} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M43 40c3 3 7 3 10 0" stroke={HAIR} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <g
        className="origin-[68px_58px] animate-[kaheel-mascot-wave_1s_ease-in-out_infinite] motion-reduce:animate-none"
        style={{ transformBox: "view-box" }}
      >
        <path d="M64 60l14-16" stroke={BODY_DARK} strokeWidth="8" strokeLinecap="round" />
        <circle cx="80" cy="42" r="7" fill={SKIN} />
      </g>
    </Frame>
  );
}

/** Curious character peeking in from the edge. */
function Peek() {
  return (
    <Frame className="animate-[kaheel-mascot-peek_2.2s_ease-in-out_infinite] motion-reduce:animate-none">
      <path d="M6 96V62a20 20 0 0 1 40 0v34z" fill={BODY} />
      <circle cx="30" cy="38" r="15" fill={SKIN} />
      <path d="M15 36a15 15 0 0 1 30 0z" fill={HAIR} />
      <circle cx="28" cy="38" r="3" fill={HAIR} />
      <circle cx="40" cy="38" r="3" fill={HAIR} />
      <path d="M28 47c4 2 8 2 12-1" stroke={HAIR} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <rect x="56" y="4" width="36" height="88" rx="10" fill={BODY_DARK} opacity="0.35" />
    </Frame>
  );
}

const MAP: Record<MascotKind, () => React.ReactElement> = {
  moto: Moto,
  lounge: Lounge,
  wave: Wave,
  peek: Peek,
};

export function PopupMascot({ kind }: { kind: MascotKind }) {
  const Scene = MAP[kind] ?? Wave;
  return (
    <div className="size-16 shrink-0 sm:size-20">
      <Scene />
    </div>
  );
}
