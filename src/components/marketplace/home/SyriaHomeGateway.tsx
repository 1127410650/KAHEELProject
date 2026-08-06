import { Link } from "@tanstack/react-router";
import { ChevronLeft, GraduationCap, MapPinned } from "lucide-react";

/**
 * Two small utility entries only. The useful tools stay one tap away without
 * turning the commerce home into a directory or study screen.
 */
export function SyriaHomeGateway() {
  return (
    <section
      id="syria-services"
      aria-label="خدمات سوريا"
      className="mx-auto w-full max-w-[1240px] scroll-mt-32 px-3 pb-1 pt-2 sm:px-5 sm:pt-3 lg:px-8"
    >
      <div className="grid grid-cols-2 gap-1.5 min-[360px]:gap-2 sm:max-w-[680px] sm:gap-3">
        <Link
          to="/syria-guide"
          className="group relative flex min-h-[56px] min-w-0 items-center gap-1.5 overflow-hidden rounded-xl border border-border bg-card p-2 shadow-[0_3px_14px_rgb(15_23_42/0.07)] transition hover:border-primary/30 hover:shadow-panel min-[360px]:min-h-[62px] min-[360px]:gap-2 min-[360px]:p-2.5 sm:min-h-[72px] sm:gap-2.5 sm:rounded-2xl sm:p-3"
        >
          <span className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-market-navy text-white min-[360px]:size-10 min-[360px]:rounded-xl sm:size-12">
            <img
              src="/images/syria-guide-flag.svg"
              alt=""
              width={96}
              height={96}
              className="absolute inset-0 size-full object-cover opacity-70"
            />
            <MapPinned className="relative size-4.5 drop-shadow sm:size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <span className="hidden truncate text-[9px] font-bold text-primary min-[360px]:block sm:text-[10px]">
              صفحة مستقلة
            </span>
            <h2 className="whitespace-nowrap text-[10px] font-black text-foreground min-[360px]:text-[12px] sm:text-sm">
              دليل سوريا
            </h2>
            <p className="mt-0.5 hidden truncate text-[8px] text-muted-foreground min-[360px]:block sm:text-[10px]">
              جامعات · مشافٍ · جهات · معالم
            </p>
          </div>
          <ChevronLeft
            className="hidden size-3.5 shrink-0 text-muted-foreground transition group-hover:-translate-x-0.5 min-[360px]:block sm:size-4"
            aria-hidden
          />
        </Link>

        <Link
          to="/student-tools"
          className="group flex min-h-[56px] min-w-0 items-center gap-1.5 rounded-xl border border-border bg-card p-2 shadow-[0_3px_14px_rgb(15_23_42/0.07)] transition hover:border-primary/30 hover:shadow-panel min-[360px]:min-h-[62px] min-[360px]:gap-2 min-[360px]:p-2.5 sm:min-h-[72px] sm:gap-2.5 sm:rounded-2xl sm:p-3"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-market-navy min-[360px]:size-10 min-[360px]:rounded-xl sm:size-12">
            <GraduationCap className="size-4.5 sm:size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <span className="hidden truncate text-[9px] font-bold text-primary min-[360px]:block sm:text-[10px]">
              للطالب السوري
            </span>
            <h2 className="whitespace-nowrap text-[10px] font-black text-foreground min-[360px]:text-[12px] sm:text-sm">
              عالم الطالب
            </h2>
            <p className="mt-0.5 hidden truncate text-[8px] text-muted-foreground min-[360px]:block sm:text-[10px]">
              تلخيص · أسئلة مراجعة
            </p>
          </div>
          <ChevronLeft
            className="hidden size-3.5 shrink-0 text-muted-foreground transition group-hover:-translate-x-0.5 min-[360px]:block sm:size-4"
            aria-hidden
          />
        </Link>
      </div>
    </section>
  );
}
