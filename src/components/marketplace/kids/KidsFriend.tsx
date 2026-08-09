import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";
import { kidsFriendArt } from "@/lib/kids-friend-assets";
import { kidsFriendMeta, type KidsFriendId, type KidsFriendMood } from "@/lib/kids-friends";

/* ═══════════════════════════════════════════════════════════════════════════
   عرض شخصيات قسم الأطفال من سجل الأصول الموحّد (`kids-friend-assets.ts`).

   الشخصيات صور 3D معتمدة بخلفية شفافة، وكل الوضعيات والحركات تُنفَّذ
   بتحويلات CSS فوق نفس الأصل — تمامًا كما في كَحيل وكَحيلان — فيبقى
   الشكل متطابقًا 100% في كل ظهور.

   الأبعاد تُثبّت دائمًا (width/height) فلا هزّة تخطيط عند تحميل الصورة.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface KidsFriendProps {
  id: KidsFriendId;
  mood?: KidsFriendMood;
  /** القياس بالبكسل — إطار مربع ثابت فلا هزّة تخطيط. */
  size?: number;
  className?: string;
  /** حركة لطيفة دائمة: قفزة صغيرة / تمايل هادئ */
  motion?: "none" | "hop" | "sway";
  title?: string | undefined;
  /** الصورة الأساسية في الشاشة الأولى؟ (نادِر — الافتراضي تحميل مؤجّل) */
  eager?: boolean;
}

/** شخصية واحدة بقياس ثابت. */
export function KidsFriend({
  id,
  mood = "happy",
  size = 48,
  className,
  motion = "none",
  title,
  eager = false,
}: KidsFriendProps) {
  const meta = kidsFriendMeta(id);
  const sad = mood === "sad";
  const art = kidsFriendArt(id, { mood: sad ? "sad" : "happy", size });
  const label = title ?? `${meta.nameAr} — ${meta.roleAr}`;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        motion === "hop" && "k-kid-hop",
        motion === "sway" && "k-kid-sway",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <img
        src={art.src}
        width={art.width}
        height={art.height}
        alt={label}
        title={label}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        className={cn(
          "h-full w-full select-none object-contain",
          // الغمزة تُحاكى بميلة صغيرة على نفس الأصل المعتمد.
          mood === "wink" && "-rotate-3",
        )}
      />
    </span>
  );
}

/**
 * شخصية تفاعلية: قفزة صغيرة + ميلة غمزة عند اللمس، ثم ترتد لحالتها.
 * الحركة على transform فقط والقياس ثابت، فلا تتحرك الصفحة.
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
      <KidsFriend
        id={id}
        size={size}
        mood={playing ? "wink" : "happy"}
        {...(title !== undefined ? { title } : {})}
      />
    </span>
  );
}
