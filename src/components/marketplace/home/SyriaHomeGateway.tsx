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

const ROTATION_MS = 3_400;

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
      className="mx-auto w-full max-w-[1240px] scroll-mt-32 px-3 pb-1 pt-1.5 sm:px-5 sm:pt-2 lg:px-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <div className="relative min-h-[84px] overflow-hidden rounded-[1rem] border border-market-silver-line bg-market-panel shadow-[0_7px_20px_rgb(0_0_0/0.14)] sm:min-h-[104px] sm:max-w-[600px] sm:rounded-[1.3rem]">
        <div
          className={
            isSyria
              ? "absolute inset-0 bg-[linear-gradient(118deg,#080a0f_0%,#111722_72%,#0144fd_165%)]"
              : "absolute inset-0 bg-[linear-gradient(118deg,#080a0f_0%,#121824_72%,#416dff_165%)]"
          }
          aria-hidden
        />

        <span
          className={
            isSyria
              ? "absolute -end-10 -top-20 size-52 rounded-full bg-market-electric/12 blur-3xl"
              : "absolute -end-10 -top-20 size-52 rounded-full bg-market-electric-bright/11 blur-3xl"
          }
          aria-hidden
        />
        <span
          className="absolute -bottom-16 start-14 size-40 rounded-full bg-market-electric/5 blur-3xl"
          aria-hidden
        />

        <Link
          key={gateway.key}
          to={gateway.to}
          className={
            reducedMotion
              ? "group relative z-10 flex min-h-[84px] items-center gap-2 px-2.5 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white sm:min-h-[104px] sm:gap-2.5 sm:px-3.5 sm:py-2.5"
              : "kahli-guide-slide group relative z-10 flex min-h-[84px] items-center gap-2 px-2.5 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white sm:min-h-[104px] sm:gap-2.5 sm:px-3.5 sm:py-2.5"
          }
          aria-label={`${gateway.title}: ${gateway.description}`}
        >
          <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-[0.8rem] border border-white/18 bg-white/12 shadow-[0_6px_18px_rgb(0_0_0/0.14)] backdrop-blur-sm sm:size-[58px] sm:rounded-[1rem]">
            {isSyria ? (
              <>
                <img
                  src="/images/syria-guide-flag.svg"
                  alt=""
                  width={176}
                  height={176}
                  className="absolute inset-0 size-full object-cover opacity-55"
                />
                <MapPinned className="relative size-5.5 drop-shadow sm:size-7" aria-hidden />
              </>
            ) : (
              <>
                <BookOpen
                  className="absolute -bottom-1 -start-1 size-7 rotate-[-10deg] text-white/13 sm:size-9"
                  aria-hidden
                />
                <GraduationCap className="relative size-5.5 drop-shadow sm:size-7" aria-hidden />
              </>
            )}
          </span>

          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/14 bg-white/10 px-1.5 py-0.5 text-[7px] font-black text-market-silver backdrop-blur-sm sm:text-[8px]">
              <Sparkles className="size-2.5 sm:size-3" aria-hidden />
              {gateway.eyebrow}
            </span>
            <h2 className="mt-0.5 text-base font-black leading-none tracking-tight sm:mt-1 sm:text-lg">
              {gateway.title}
            </h2>
            <p className="mt-1 hidden max-w-[28rem] text-[10px] leading-4 text-white/72 sm:line-clamp-1">
              {gateway.description}
            </p>
            <span className="mt-1 inline-flex items-center gap-1 text-[8px] font-black text-market-silver sm:mt-1.5 sm:text-[10px]">
              {gateway.cta}
              <ArrowLeft className="size-3.5 transition group-hover:-translate-x-0.5" aria-hidden />
            </span>
          </div>
        </Link>

        <div
          className="absolute inset-y-0 end-2 z-20 flex flex-col items-center justify-center gap-1 sm:end-2.5"
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
                  ? "h-4 w-1 rounded-full bg-market-electric-bright transition-all"
                  : "size-1.5 rounded-full bg-market-electric-bright/30 transition-all hover:bg-market-electric-bright/65"
              }
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes kahli-guide-slide-in {
          from { opacity: .68; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .kahli-guide-slide {
          animation: kahli-guide-slide-in 340ms cubic-bezier(.2,.8,.2,1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .kahli-guide-slide { animation: none !important; }
        }
      `}</style>
    </section>
  );
}
