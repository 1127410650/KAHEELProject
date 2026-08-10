/**
 * شريط «ستوريات كَحيل» + عارض الشاشة الكاملة.
 *
 * الخفة أولوية مطلقة:
 * • لا فيديو ولا مكتبات إضافية — كل ستوري خلفية CSS متدرجة + نص + شخصية.
 * • صور الستوريات لا تُطلب إلا بعد فتح العارض (`useStoryImages(open)`).
 * • ارتفاع الشريط محجوز مسبقًا (`min-h`) ⇒ صفر هزّة تخطيط أثناء التحميل.
 * • كل الحركات CSS وتُعطّل تحت `prefers-reduced-motion`.
 */
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Mascot } from "@/components/marketplace/campaign/Mascot";
import { useI18n } from "@/i18n";
import {
  STORY_GRADIENT_CSS,
  storyPose,
  trackStory,
  useLiveStories,
  useSeenStories,
  useStoryImages,
  type Story,
} from "@/lib/mkt-stories";

/** مدة عرض الستوري الواحدة قبل الانتقال التلقائي. */
const STORY_MS = 5000;

export function KaheelStories() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { data: stories } = useLiveStories();
  const { seen, markSeen } = useSeenStories();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const list = useMemo(() => stories ?? [], [stories]);
  const images = useStoryImages(list, openIndex !== null);

  if (list.length === 0) return null;

  return (
    <section aria-label={ar ? "ستوريات كَحيل" : "Kaheel stories"} className="min-h-[112px]">
      <ul className="flex list-none gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {list.map((story, index) => {
          const isSeen = seen.includes(story.id);
          return (
            <li key={story.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setOpenIndex(index)}
                className="k-press flex w-[86px] flex-col items-center gap-1.5 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                <span
                  className="grid size-[66px] place-items-center rounded-full p-[3px]"
                  style={{
                    background: isSeen
                      ? "linear-gradient(140deg,#cfc6dd,#b9aecb)"
                      : "linear-gradient(140deg,#ff8500,#c77dff 45%,#5a189a)",
                  }}
                >
                  <span
                    className="grid size-full place-items-center overflow-hidden rounded-full bg-white"
                    style={{ background: STORY_GRADIENT_CSS[story.gradient] }}
                  >
                    <Mascot
                      name={story.mascot}
                      pose={storyPose(story)}
                      lang={ar ? "ar" : "en"}
                      className="h-[52px] w-auto"
                    />
                  </span>
                </span>
                <span className="line-clamp-2 min-h-[26px] w-full text-center text-[10px] font-bold leading-[13px] text-brand-900">
                  {ar ? story.title_ar : story.title_en}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {openIndex !== null ? (
        <StoryViewer
          stories={list}
          startIndex={openIndex}
          images={images.data ?? {}}
          onSeen={markSeen}
          onClose={() => setOpenIndex(null)}
        />
      ) : null}
    </section>
  );
}

function StoryViewer({
  stories,
  startIndex,
  images,
  onSeen,
  onClose,
}: {
  stories: Story[];
  startIndex: number;
  images: Record<string, string>;
  onSeen: (id: string) => void;
  onClose: () => void;
}) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const navigate = useNavigate();
  const [index, setIndex] = useState(startIndex);
  const [dragY, setDragY] = useState(0);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const story = stories[index];

  // مراجع ثابتة: تمنع إعادة تشغيل التأثيرات عند تغيّر هوية الدوال الممرَّرة.
  const onSeenRef = useRef(onSeen);
  onSeenRef.current = onSeen;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const close = useCallback(() => onCloseRef.current(), []);

  const next = useCallback(() => {
    setIndex((current) => {
      if (current + 1 >= stories.length) {
        close();
        return current;
      }
      return current + 1;
    });
  }, [close, stories.length]);

  const previous = useCallback(() => setIndex((current) => Math.max(0, current - 1)), []);

  // مشاهدة محسوبة مرة واحدة لكل ستوري. مفصولة عن المؤقّت حتى لا يعيد أي
  // تغيّر في هوية الدوال حساب المشاهدة (كان يسبّب حلقة تحديث لا نهائية).
  const storyId = story?.id;
  useEffect(() => {
    if (!storyId) return;
    onSeenRef.current(storyId);
    trackStory(storyId, "view");
  }, [storyId]);

  // تقدّم تلقائي بعد مدة العرض.
  useEffect(() => {
    if (!storyId) return;
    const timer = window.setTimeout(next, STORY_MS);
    return () => window.clearTimeout(timer);
  }, [next, storyId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") (ar ? previous : next)();
      if (event.key === "ArrowLeft") (ar ? next : previous)();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [ar, close, next, previous]);

  if (!story) return null;

  const imageUrl = story.image_path ? images[story.image_path] : undefined;

  const openTarget = () => {
    trackStory(story.id, "click");
    close();
    const url = story.click_url || "/search";
    void navigate({ href: url });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ar ? story.title_ar : story.title_en}
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 backdrop-blur-sm animate-[fade-in_0.18s_ease-out]"
      style={{ transform: `translateY(${dragY}px)`, opacity: dragY > 0 ? 1 - dragY / 320 : 1 }}
      onPointerDown={(event) => {
        startRef.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerMove={(event) => {
        const start = startRef.current;
        if (!start) return;
        const dy = event.clientY - start.y;
        if (dy > 0 && Math.abs(dy) > Math.abs(event.clientX - start.x)) setDragY(dy);
      }}
      onPointerUp={(event) => {
        const start = startRef.current;
        startRef.current = null;
        if (!start) return;
        if (dragY > 110) {
          close();
          return;
        }
        setDragY(0);
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dy) > 60) return;
        // نصف الشاشة الأمامي يتقدّم، والخلفي يرجع — باتجاه اللغة.
        if (Math.abs(dx) > 40) {
          if (dx > 0) (ar ? previous : next)();
          else (ar ? next : previous)();
          return;
        }
        const midpoint = window.innerWidth / 2;
        const forward = ar ? event.clientX < midpoint : event.clientX > midpoint;
        if (forward) next();
        else previous();
      }}
    >
      <div
        className="relative flex h-full max-h-[100dvh] w-full max-w-[460px] flex-col overflow-hidden text-white sm:h-[86vh] sm:rounded-[26px]"
        style={{ background: STORY_GRADIENT_CSS[story.gradient] }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            width={story.image_width}
            height={story.image_height}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover opacity-70"
          />
        ) : null}

        {/* شريط التقدّم */}
        <div className="relative z-10 flex gap-1 p-3">
          {stories.map((item, itemIndex) => (
            <span key={item.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <span
                className="block h-full rounded-full bg-white"
                style={
                  itemIndex < index
                    ? { width: "100%" }
                    : itemIndex === index
                      ? {
                          width: "100%",
                          animation: `k-story-progress ${STORY_MS}ms linear forwards`,
                          transformOrigin: "left",
                        }
                      : { width: 0 }
                }
              />
            </span>
          ))}
        </div>

        <div className="relative z-10 flex items-center justify-between px-4">
          <span className="rounded-full bg-black/25 px-3 py-1 text-[11px] font-black">
            {ar ? "ستوريات كَحيل" : "Kaheel stories"}
          </span>
          <button
            type="button"
            onClick={close}
            aria-label={ar ? "إغلاق" : "Close"}
            className="k-press grid size-9 place-items-center rounded-full bg-black/30 outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="relative z-10 mt-auto flex flex-col items-center gap-3 p-5 pb-8 text-center">
          <Mascot
            name={story.mascot}
            pose={storyPose(story)}
            lang={ar ? "ar" : "en"}
            priority
            className="h-[190px] w-auto animate-[k-story-mascot-in_0.5s_cubic-bezier(0.34,1.56,0.64,1)_both] motion-reduce:animate-none sm:h-[230px]"
          />
          <h3 className="text-xl font-black leading-tight drop-shadow">
            {ar ? story.title_ar : story.title_en}
          </h3>
          <p className="max-w-[36ch] text-sm font-semibold leading-relaxed text-white/90">
            {ar ? story.body_ar : story.body_en}
          </p>
          <button
            type="button"
            onClick={openTarget}
            className="k-press mt-1 inline-flex min-h-11 items-center rounded-full bg-white px-6 text-sm font-black text-brand-900 outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {(ar ? story.cta_ar : story.cta_en) || (ar ? "اذهب للعرض" : "Go to the offer")}
          </button>
        </div>
      </div>
    </div>
  );
}
