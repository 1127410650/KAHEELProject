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
 * row or a heavy media asset.
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
      className="mx-auto w-full max-w-[1240px] scroll-mt-32 px-3 pb-1 pt-2 sm:px-5 sm:pt-3 lg:px-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <div className="relative min-h-[128px] overflow-hidden rounded-[1.35rem] border border-market-navy/10 bg-market-navy shadow-[0_10px_30px_rgb(15_23_42/0.13)] sm:min-h-[148px] sm:max-w-[680px] sm:rounded-[1.75rem]">
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
              ? "group relative z-10 flex min-h-[128px] items-center gap-3 px-4 py-4 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white sm:min-h-[148px] sm:gap-4 sm:px-5"
              : "kahli-guide-slide group relative z-10 flex min-h-[128px] items-center gap-3 px-4 py-4 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white sm:min-h-[148px] sm:gap-4 sm:px-5"
          }
          aria-label={`${gateway.title}: ${gateway.description}`}
        >
          <span className="relative grid size-[72px] shrink-0 place-items-center overflow-hidden rounded-[1.3rem] border border-white/18 bg-white/12 shadow-[0_10px_26px_rgb(0_0_0/0.16)] backdrop-blur-sm sm:size-[88px] sm:rounded-[1.55rem]">
            {isSyria ? (
              <>
                <img
                  src="/images/syria-guide-flag.svg"
                  alt=""
                  width={176}
                  height={176}
                  className="absolute inset-0 size-full object-cover opacity-55"
                />
                <MapPinned className="relative size-8 drop-shadow sm:size-9" aria-hidden />
              </>
            ) : (
              <>
                <BookOpen
                  className="absolute -bottom-1 -start-1 size-10 rotate-[-10deg] text-white/13 sm:size-12"
                  aria-hidden
                />
                <GraduationCap className="relative size-8 drop-shadow sm:size-9" aria-hidden />
              </>
            )}
          </span>

          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/14 bg-white/10 px-2 py-1 text-[9px] font-black text-market-silver backdrop-blur-sm sm:text-[10px]">
              <Sparkles className="size-3" aria-hidden />
              {gateway.eyebrow}
            </span>
            <h2 className="mt-1.5 text-xl font-black leading-none tracking-tight sm:text-2xl">
              {gateway.title}
            </h2>
            <p className="mt-1.5 line-clamp-2 max-w-[28rem] text-[10px] leading-5 text-white/72 sm:text-xs sm:leading-6">
              {gateway.description}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-black text-market-silver sm:text-xs">
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
                  ? "h-7 w-1.5 rounded-full bg-market-silver shadow-[0_0_10px_rgb(255_255_255/0.45)] transition-all"
                  : "size-1.5 rounded-full bg-white/38 transition-all hover:bg-white/70"
              }
            />
          ))}
        </div>

        {!reducedMotion && !paused ? (
          <span
            key={`progress-${active}`}
            className="kahli-guide-progress absolute inset-x-0 bottom-0 z-20 h-0.5 origin-right bg-market-silver/85"
            aria-hidden
          />
        ) : null}
      </div>

      <style>{`
        @keyframes kahli-guide-slide-in {
          from { opacity: 0; transform: translateY(13px) scale(.992); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes kahli-guide-progress {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        .kahli-guide-slide {
          animation: kahli-guide-slide-in 520ms cubic-bezier(.2,.8,.2,1) both;
        }
        .kahli-guide-progress {
          animation: kahli-guide-progress ${ROTATION_MS}ms linear both;
        }
        @media (prefers-reduced-motion: reduce) {
          .kahli-guide-slide,
          .kahli-guide-progress { animation: none !important; }
        }
      `}</style>
    </section>
  );
}
