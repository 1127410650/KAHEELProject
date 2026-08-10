import { Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, GraduationCap, MapPinned, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

const GATEWAYS = [
  {
    key: "syria",
    to: "/guides/syria",
    eyebrow: "دليلك داخل سوريا",
    title: "دليل سوريا",
    description: "جامعات ومشافٍ وجهات حكومية ومعالم مهمة في مكان واحد.",
    cta: "افتح الدليل",
  },
  {
    key: "student",
    to: "/guides/students",
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
      /* بلا حاوية/حشوة خاصة: الصفحة الرئيسية تتولى العرض والإيقاع. */
      className="w-full scroll-mt-32"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      {/* نفس نظام البطاقات الموحّد (k-surface) كبقية أقسام الرئيسية. */}
      <div className="k-surface relative w-full overflow-hidden">
        <span
          className="absolute -end-10 -top-20 size-52 rounded-full bg-brand-400/22 blur-3xl"
          aria-hidden
        />
        <span
          className="absolute -bottom-16 start-14 size-40 rounded-full bg-brand-300/25 blur-3xl"
          aria-hidden
        />

        <Link
          key={gateway.key}
          to={gateway.to}
          className={
            reducedMotion
              ? "group relative z-10 flex items-center gap-3 px-3 py-3 text-brand-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700 sm:gap-4 sm:py-4"
              : "kahli-guide-slide group relative z-10 flex items-center gap-3 px-3 py-3 text-brand-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700 sm:gap-4 sm:py-4"
          }
          aria-label={`${gateway.title}: ${gateway.description}`}
        >
          <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-[0.8rem] border-2 border-white bg-[radial-gradient(circle_at_32%_25%,color-mix(in_srgb,var(--kt-primary)_10%,transparent),color-mix(in_srgb,var(--kt-primary)_35%,transparent)_78%)] text-primary shadow-[inset_0_1px_0_#fff,0_6px_14px_-6px_color-mix(in_srgb,var(--kt-primary)_45%,transparent)] sm:size-[58px] sm:rounded-[1rem]">
            {isSyria ? (
              <>
                <img
                  src="/images/syria-guide-flag.svg"
                  alt=""
                  width={176}
                  height={176}
                  className="absolute inset-0 size-full object-cover opacity-45"
                />
                <MapPinned className="relative size-5.5 sm:size-7" aria-hidden />
              </>
            ) : (
              <>
                <BookOpen
                  className="absolute -bottom-1 -start-1 size-7 rotate-[-10deg] text-brand-700/20 sm:size-9"
                  aria-hidden
                />
                <GraduationCap className="relative size-5.5 sm:size-7" aria-hidden />
              </>
            )}
          </span>

          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1 rounded-full border border-brand-400/35 bg-brand-300/25 px-[var(--sp-2)] py-0.5 text-desc font-black text-brand-800">
              <Sparkles className="size-2.5 sm:size-3" aria-hidden />
              {gateway.eyebrow}
            </span>
            <h2 className="text-section mt-0.5 font-black leading-none sm:mt-1">
              {gateway.title}
            </h2>
            <p className="mt-1 line-clamp-2 max-w-[28rem] text-desc leading-4 text-brand-800 sm:line-clamp-1">
              {gateway.description}
            </p>

            <span className="mt-1 inline-flex items-center gap-1 text-desc font-black text-brand-700 sm:mt-[var(--sp-2)] sm:text-desc">
              {gateway.cta}
              <ArrowLeft className="size-3.5 transition group-hover:-translate-x-0.5" aria-hidden />
            </span>
          </div>
        </Link>


        {/* مؤشر الدليل: هدف لمس مريح 40px مع نقطة صغيرة مرئية، وطبقة مطلقة
            في الأسفل فلا يمتد الزر كشريط عمودي ولا يزيد ارتفاع البطاقة. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-center"
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
              className="pointer-events-auto grid h-8 w-6 place-items-center"
            >
              <span
                aria-hidden
                className={
                  active === index
                    ? "block h-1 w-4 rounded-full bg-brand-700 transition-all"
                    : "block size-1 rounded-full bg-brand-700/40 transition-all"
                }

              />
            </button>
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
