import { useCallback, useState, type ReactElement } from "react";

import { cn } from "@/lib/utils";
import { kidsFriendMeta, type KidsFriendId, type KidsFriendMood } from "@/lib/kids-friends";

/* ═══════════════════════════════════════════════════════════════════════════
   رسم الشخصيات الأصلية (SVG متجهي، خلفية شفافة، ~2KB لكل شخصية).
   كل الأشكال أصلية 100%: دوائر وأقواس ناعمة بنسب موحّدة حتى تبدو الخمسة
   عائلة بصرية واحدة: رأس كبير، عيون كبيرة مستديرة، وجنتان ورديتان،
   ولمسة بنفسجية من هوية كَحيل في التفاصيل.
   ═══════════════════════════════════════════════════════════════════════════ */

const VIOLET = "#7b2cbf";
const VIOLET_SOFT = "#c77dff";
const BLUSH = "#ff9db1";
const INK = "#3a2352";

/** عينان كبيرتان مستديرتان — الأساس المشترك لكل العائلة. */
function Eyes({ cx = 32, cy = 30, gap = 8, r = 5.4, mood }: {
  cx?: number; cy?: number; gap?: number; r?: number; mood: KidsFriendMood;
}) {
  const left = cx - gap;
  const right = cx + gap;
  if (mood === "sad") {
    return (
      <g>
        {[left, right].map((x) => (
          <g key={x}>
            <circle cx={x} cy={cy} r={r} fill="#ffffff" stroke={INK} strokeWidth={1.1} />
            <circle cx={x} cy={cy + 1} r={r * 0.46} fill={INK} />
            <circle cx={x - r * 0.22} cy={cy + 0.2} r={r * 0.16} fill="#ffffff" />
          </g>
        ))}
        {/* حاجبان مائلان للأعلى نحو الداخل = تعبير حزين لطيف (لا غاضب) */}
        <path
          d={`M${left - r} ${cy - r - 1.2} L${left + r * 0.8} ${cy - r - 3.2}`}
          fill="none" stroke={INK} strokeWidth={1.5} strokeLinecap="round"
        />
        <path
          d={`M${right + r} ${cy - r - 1.2} L${right - r * 0.8} ${cy - r - 3.2}`}
          fill="none" stroke={INK} strokeWidth={1.5} strokeLinecap="round"
        />
      </g>
    );
  }
  return (
    <g>
      <g>
        {mood === "wink" ? (
          <path
            d={`M${left - r} ${cy} q ${r} ${r * 0.9} ${r * 2} 0`}
            fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round"
          />
        ) : (
          <>
            <circle cx={left} cy={cy} r={r} fill="#ffffff" stroke={INK} strokeWidth={1.1} />
            <circle cx={left} cy={cy + 0.4} r={r * 0.5} fill={INK} />
            <circle cx={left - r * 0.24} cy={cy - r * 0.28} r={r * 0.2} fill="#ffffff" />
          </>
        )}
      </g>
      <circle cx={right} cy={cy} r={r} fill="#ffffff" stroke={INK} strokeWidth={1.1} />
      <circle cx={right} cy={cy + 0.4} r={r * 0.5} fill={INK} />
      <circle cx={right - r * 0.24} cy={cy - r * 0.28} r={r * 0.2} fill="#ffffff" />
    </g>
  );
}

function Mouth({ cx = 32, cy = 41, w = 7, mood }: { cx?: number; cy?: number; w?: number; mood: KidsFriendMood }) {
  if (mood === "sad") {
    return (
      <path
        d={`M${cx - w * 0.6} ${cy + 2} q ${w * 0.6} -3.4 ${w * 1.2} 0`}
        fill="none" stroke={INK} strokeWidth={1.7} strokeLinecap="round"
      />
    );
  }
  return (
    <path
      d={`M${cx - w * 0.7} ${cy - 1} q ${w * 0.7} ${w * 0.8} ${w * 1.4} 0`}
      fill="none" stroke={INK} strokeWidth={1.7} strokeLinecap="round"
    />
  );
}

function Blush({ cx = 32, cy = 39, gap = 13 }: { cx?: number; cy?: number; gap?: number }) {
  return (
    <g opacity={0.55}>
      <ellipse cx={cx - gap} cy={cy} rx={3.4} ry={2.2} fill={BLUSH} />
      <ellipse cx={cx + gap} cy={cy} rx={3.4} ry={2.2} fill={BLUSH} />
    </g>
  );
}

function Tear({ x, y }: { x: number; y: number }) {
  return <path d={`M${x} ${y} q 2.2 3 0 4.6 q -2.2 -1.6 0 -4.6`} fill="#7cc6f5" opacity={0.9} />;
}

/* ── عصفور: زقزوق (الألعاب) ─────────────────────────────────────────────── */
function Birdy({ mood }: { mood: KidsFriendMood }) {
  return (
    <g>
      <path d="M14 34 q -8 -3 -9 4 q 6 2 9 -1 Z" fill={VIOLET_SOFT} />
      <path d="M50 34 q 8 -3 9 4 q -6 2 -9 -1 Z" fill={VIOLET_SOFT} />
      <ellipse cx={32} cy={36} rx={20} ry={19} fill="#59c8f2" />
      <ellipse cx={32} cy={44} rx={13} ry={10} fill="#bfeaff" />
      <path d="M26 14 q 3 -8 6 -1 q 3 -7 6 1 Z" fill={VIOLET} />
      <Eyes cy={31} gap={7.5} r={5.6} mood={mood} />
      <path d="M32 38 l 6 4 l -6 4 l -6 -4 Z" fill="#ff9e2c" stroke="#e07c10" strokeWidth={0.8} />
      <Blush cy={40} gap={14} />
      {mood === "sad" ? <Tear x={24} y={37} /> : null}
      <path d="M22 54 l -3 5 M42 54 l 3 5" stroke="#ff9e2c" strokeWidth={2.4} strokeLinecap="round" fill="none" />
    </g>
  );
}

/* ── قطة: مشمشة (ملابس الأطفال) ─────────────────────────────────────────── */
function Kitty({ mood }: { mood: KidsFriendMood }) {
  return (
    <g>
      <path d="M14 22 l 1 -12 l 10 7 Z" fill="#ffc98b" />
      <path d="M50 22 l -1 -12 l -10 7 Z" fill="#ffc98b" />
      <path d="M17 19 l 0.6 -6 l 5 3.5 Z" fill={BLUSH} />
      <path d="M47 19 l -0.6 -6 l -5 3.5 Z" fill={BLUSH} />
      <ellipse cx={32} cy={34} rx={20} ry={18} fill="#ffd9a8" />
      <path d="M32 48 q -12 0 -14 8 q 14 4 28 0 q -2 -8 -14 -8 Z" fill={VIOLET_SOFT} />
      <Eyes cy={31} gap={8} r={5.4} mood={mood} />
      <path d="M32 38 l 2.4 2.2 h -4.8 Z" fill={BLUSH} />
      <Mouth cy={44} w={6} mood={mood} />
      <Blush cy={40} gap={13.5} />
      {mood === "sad" ? <Tear x={24} y={37} /> : null}
      <path d="M12 34 h -7 M12 38 h -6 M52 34 h 7 M52 38 h 6" stroke={INK} strokeWidth={1.1} strokeLinecap="round" opacity={0.6} />
    </g>
  );
}

/* ── دبدوب: مستلزمات الرضّع ──────────────────────────────────────────────── */
function Bear({ mood }: { mood: KidsFriendMood }) {
  return (
    <g>
      <circle cx={15} cy={19} r={7.5} fill="#c98b5e" />
      <circle cx={49} cy={19} r={7.5} fill="#c98b5e" />
      <circle cx={15} cy={19} r={4} fill={BLUSH} />
      <circle cx={49} cy={19} r={4} fill={BLUSH} />
      <ellipse cx={32} cy={34} rx={20} ry={18.5} fill="#dfa778" />
      <ellipse cx={32} cy={42} rx={11.5} ry={9} fill="#f7ddc4" />
      <Eyes cy={30} gap={8} r={5.2} mood={mood} />
      <ellipse cx={32} cy={38.5} rx={3.4} ry={2.6} fill={INK} />
      <Mouth cy={45} w={6} mood={mood} />
      <Blush cy={36} gap={15} />
      {mood === "sad" ? <Tear x={23.5} y={36} /> : null}
      <path d="M20 53 q 12 6 24 0 l 0 3 q -12 6 -24 0 Z" fill={VIOLET} />
    </g>
  );
}

/* ── أرنب: نبنوب (القرطاسية والمدارس) ───────────────────────────────────── */
function Bunny({ mood }: { mood: KidsFriendMood }) {
  return (
    <g>
      <ellipse cx={25} cy={13} rx={4.6} ry={11} fill="#f3f0ff" stroke={VIOLET_SOFT} strokeWidth={1} />
      <ellipse cx={39} cy={13} rx={4.6} ry={11} fill="#f3f0ff" stroke={VIOLET_SOFT} strokeWidth={1} />
      <ellipse cx={25} cy={14} rx={2.2} ry={7} fill={BLUSH} opacity={0.7} />
      <ellipse cx={39} cy={14} rx={2.2} ry={7} fill={BLUSH} opacity={0.7} />
      <ellipse cx={32} cy={36} rx={19.5} ry={18} fill="#f7f4ff" stroke="#e3daf7" strokeWidth={1} />
      <Eyes cy={33} gap={8} r={5.4} mood={mood} />
      <path d="M32 40 l 2.4 2.2 h -4.8 Z" fill={VIOLET} />
      <Mouth cy={46} w={6} mood={mood} />
      <Blush cy={42} gap={13.5} />
      {mood === "sad" ? <Tear x={24} y={39} /> : null}
      <path d="M11 36 h -6 M11 40 h -5 M53 36 h 6 M53 40 h 5" stroke="#b9a8d6" strokeWidth={1.1} strokeLinecap="round" />
      <rect x={41} y={48} width={5} height={13} rx={2} fill={VIOLET_SOFT} transform="rotate(24 43 54)" />
      <path d="M41.6 47.4 l 4.8 1.4 l -2.6 -4.4 Z" fill="#ffcf5a" transform="rotate(24 43 54)" />
    </g>
  );
}

/* ── نجمة بحر: نجمة (الصيف والمسابح) ────────────────────────────────────── */
function Starfish({ mood }: { mood: KidsFriendMood }) {
  return (
    <g>
      <path
        d="M32 5 q 4 0 5.4 5.6 l 3.4 13.6 l 13.8 -3 q 5.4 -1.2 6.4 3 q 1 4.2 -3.4 6.4 l -12 6.4 l 6.6 12.6 q 2.6 5 -1.2 7.4 q -3.8 2.4 -7 -1.8 l -8.6 -11 l -8.6 11 q -3.2 4.2 -7 1.8 q -3.8 -2.4 -1.2 -7.4 l 6.6 -12.6 l -12 -6.4 q -4.4 -2.2 -3.4 -6.4 q 1 -4.2 6.4 -3 l 13.8 3 l 3.4 -13.6 Q 28 5 32 5 Z"
        fill="#ffb648" stroke="#f09322" strokeWidth={1.2} strokeLinejoin="round"
      />
      <g opacity={0.5} fill="#ffd699">
        <circle cx={32} cy={16} r={1.6} />
        <circle cx={46} cy={30} r={1.6} />
        <circle cx={18} cy={30} r={1.6} />
        <circle cx={26} cy={49} r={1.6} />
        <circle cx={40} cy={49} r={1.6} />
      </g>
      <Eyes cy={31} gap={7.5} r={5.2} mood={mood} />
      <Mouth cy={41} w={6.5} mood={mood} />
      <Blush cy={38} gap={12.5} />
      {mood === "sad" ? <Tear x={23.5} y={37} /> : null}
    </g>
  );
}

const RENDERERS: Record<KidsFriendId, (p: { mood: KidsFriendMood }) => ReactElement> = {
  birdy: Birdy,
  mishmisha: Kitty,
  dabdoob: Bear,
  nabnab: Bunny,
  najma: Starfish,
};

export interface KidsFriendProps {
  id: KidsFriendId;
  mood?: KidsFriendMood;
  /** القياس بالبكسل — يُثبّت العرض والارتفاع معًا فلا هزّة تخطيط. */
  size?: number;
  className?: string;
  /** حركة لطيفة دائمة: قفزة / تلويح */
  motion?: "none" | "hop" | "sway";
  title?: string | undefined;
}

/** رسم شخصية واحدة. */
export function KidsFriend({
  id,
  mood = "happy",
  size = 48,
  className,
  motion = "none",
  title,
}: KidsFriendProps) {
  const Render = RENDERERS[id];
  const meta = kidsFriendMeta(id);
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label={title ?? `${meta.nameAr} — ${meta.roleAr}`}
      className={cn(
        "shrink-0 overflow-visible",
        motion === "hop" && "k-kid-hop",
        motion === "sway" && "k-kid-sway",
        className,
      )}
    >
      <title>{title ?? `${meta.nameAr} — ${meta.roleAr}`}</title>
      <Render mood={mood} />
    </svg>
  );
}

/**
 * شخصية تفاعلية: قفزة صغيرة + غمزة عند اللمس، ثم ترتد لحالتها.
 * الحركة على transform فقط، والقياس ثابت فلا تتحرك الصفحة.
 */
export function KidsFriendTap({
  id,
  size = 44,
  className,
  title,
}: {
  id: KidsFriendId;
  size?: number;
  className?: string;
  title?: string | undefined;
}) {
  const [playing, setPlaying] = useState(false);
  const play = useCallback(() => {
    setPlaying(true);
    window.setTimeout(() => setPlaying(false), 620);
  }, []);
  return (
    <span
      onPointerDown={play}
      className={cn("inline-flex", playing && "k-kid-jump", className)}
      style={{ width: size, height: size }}
    >
      <KidsFriend id={id} size={size} mood={playing ? "wink" : "happy"} title={title} />
    </span>
  );
}
