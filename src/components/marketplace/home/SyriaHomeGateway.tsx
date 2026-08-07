import { Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, GraduationCap, MapPinned, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

const GATEWAYS = [
  {
    key: "syria",
    to: "/syria-guide",
    eyebrow: "دليلك داخل سوريا",
    title: "دليل سوريا",
    description: "جامعات ومشافٍ وجهات حكومية ومعالم مهمة في مكان واحد.",
    cta: "افتح الدليل",
  },
  {
    key: "student",
    to: "/student-tools",
    eyebrow: "رفيق الطالب السوري",
    title: "دليل الطالب",
    description: "لخّص دروسك وأنشئ أسئلة مراجعة مجانًا وبخطوات بسيطة.",
    cta: "ابدأ الآن",
  },
] as const;

const ROTATION_MS = 4_000;

/**
 * One compact service advert in the original gateway position. It alternates
 * vertically between the Syria and student guides without adding another home
 * row, a visible countdown, or a heavy media asset.
 */
export function SyriaHomeGateway() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setTimeout(() => {
      setActive((current) => (current + 1) % GATEWAYS.length);
    }, ROTATION_MS);
    return () => window.clearTimeout(timer);
  }, [active, paused, reducedMotion]);

  const gateway = GATEWAYS[active] ?? GATEWAYS[0];
  const isSyria = gateway.key === "syria";

  return (
    <section
      id="syria-services"
      aria-label="دليل سوريا ودليل الطالب"
      aria-roledescription="إعلان متناوب"
      role="region"
      className="mx-auto w-full max-w-[1240px] scroll-mt-32 px-3 pb-1 pt-2 sm:px-5 sm:pt-2.5 lg:px-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <div className="relative min-h-[104px] overflow-hidden rounded-[1.2rem] border border-market-navy/10 bg-market-navy shadow-[0_8px_24px_rgb(15_23_42/0.12)] sm:min-h-[120px] sm:max-w-[640px] sm:rounded-[1.5rem]">
        <div
          className={
            isSyria
              ? "absolute inset-0 bg-[linear-gradient(118deg,#05060a_0%,#0f194f_56%,#0144fd_130%)]"
              : "absolute inset-0 bg-[linear-gradient(118deg,#05060a_0%,#10266f_52%,#0144fd_130%)]"
          }
          aria-hidden
        />

        <span
          className={
            isSyria
              ? "absolute -end-10 -top-20 size-52 rounded-full bg-market-electric/24 blur-3xl"
              : "absolute -end-10 -top-20 size-52 rounded-full bg-market-electric-bright/22 blur-3xl"
          }
          aria-hidden
        />
        <span
          className="absolute -bottom-16 start-14 size-40 rounded-full bg-white/8 blur-3xl"
          aria-hidden
        />

        <Link
          key={gateway.key}
          to={gateway.to}
          className={
            reducedMotion
              ? "group relative z-10 flex min-h-[104px] items-center gap-2.5 px-3 py-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white sm:min-h-[120px] sm:gap-3 sm:px-4"
              : "kahli-guide-slide group relative z-10 flex min-h-[104px] items-center gap-2.5 px-3 py-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white sm:min-h-[120px] sm:gap-3 sm:px-4"
          }
          aria-label={`${gateway.title}: ${gateway.description}`}
        >
          <span className="relative grid size-[58px] shrink-0 place-items-center overflow-hidden rounded-[1rem] border border-white/18 bg-white/12 shadow-[0_8px_22px_rgb(0_0_0/0.15)] backdrop-blur-sm sm:size-[68px] sm:rounded-[1.2rem]">
            {isSyria ? (
              <>
                <img
                  src="/images/syria-guide-flag.svg"
                  alt=""
                  width={176}
                  height={176}
                  className="absolute inset-0 size-full object-cover opacity-55"
                />
                <MapPinned className="relative size-7 drop-shadow sm:size-8" aria-hidden />
              </>
            ) : (
              <>
                <BookOpen
                  className="absolute -bottom-1 -start-1 size-9 rotate-[-10deg] text-white/13 sm:size-10"
                  aria-hidden
                />
                <GraduationCap className="relative size-7 drop-shadow sm:size-8" aria-hidden />
              </>
            )}
          </span>

          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/14 bg-white/10 px-1.5 py-0.5 text-[8px] font-black text-market-silver backdrop-blur-sm sm:px-2 sm:text-[9px]">
              <Sparkles className="size-3" aria-hidden />
              {gateway.eyebrow}
            </span>
            <h2 className="mt-1 text-lg font-black leading-none tracking-tight sm:text-xl">
              {gateway.title}
            </h2>
            <p className="mt-1 line-clamp-1 max-w-[28rem] text-[9px] leading-4 text-white/72 sm:text-[11px] sm:leading-5">
              {gateway.description}
            </p>
            <span className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-black text-market-silver sm:text-[11px]">
              {gateway.cta}
              <ArrowLeft className="size-3.5 transition group-hover:-translate-x-0.5" aria-hidden />
            </span>
          </div>
        </Link>

        <div
          className="absolute inset-y-0 end-2.5 z-20 flex flex-col items-center justify-center gap-1.5 sm:end-3"
          aria-label="اختر الدليل"
          role="group"
        >
          {GATEWAYS.map((item, index) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`عرض ${item.title}`}
              aria-pressed={active === index}
              className={
                active === index
                  ? "h-5 w-1.5 rounded-full bg-market-silver shadow-[0_0_10px_rgb(255_255_255/0.45)] transition-all"
                  : "size-1.5 rounded-full bg-white/38 transition-all hover:bg-white/70"
              }
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes kahli-guide-slide-in {
          from { opacity: 0; transform: translateY(13px) scale(.992); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .kahli-guide-slide {
          animation: kahli-guide-slide-in 520ms cubic-bezier(.2,.8,.2,1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .kahli-guide-slide { animation: none !important; }
        }
      `}</style>
    </section>
  );
}
