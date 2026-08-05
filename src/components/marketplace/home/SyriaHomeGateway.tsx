import { Link } from "@tanstack/react-router";
import { BookOpen, ChevronLeft, FileText, ListChecks, MapPinned, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { createStudyQuestions, summarizeLocally } from "@/lib/syria-directory";

type StudyMode = "summary" | "questions";

/**
 * Syria-only home gateway. The directory opens as its own full page while the
 * student assistant remains an independent home-page tool.
 */
export function SyriaHomeGateway() {
  const [studyText, setStudyText] = useState("");
  const [studyMode, setStudyMode] = useState<StudyMode>("summary");

  const studyResult = useMemo(() => {
    const value = studyText.trim();
    if (!value) return [];
    return studyMode === "summary"
      ? summarizeLocally(value, 4)
      : createStudyQuestions(value, 6);
  }, [studyMode, studyText]);

  return (
    <section
      id="syria-services"
      className="mx-auto w-full max-w-[1240px] scroll-mt-32 px-4 pb-2 pt-4 sm:px-5 sm:pt-5 lg:px-8"
    >
      <div className="grid gap-3 lg:grid-cols-[1.12fr_0.88fr]">
        <Link
          to="/syria-guide"
          className="group relative isolate min-h-[245px] overflow-hidden rounded-[1.6rem] border border-white/10 bg-market-navy text-white shadow-[0_14px_42px_rgb(15_23_42/0.16)] sm:min-h-[280px]"
        >
          <img
            src="/images/syria-guide-flag.svg"
            alt="خلفية فنية مستوحاة من علم سوريا"
            className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-[1.04]"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-market-navy/96 via-market-navy/74 to-market-navy/34" />
          <div className="relative flex min-h-[245px] flex-col justify-between p-5 sm:min-h-[280px] sm:p-7">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-black backdrop-blur sm:text-xs">
                <MapPinned className="size-4" aria-hidden />
                نسخة سوريا
              </span>
              <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">دليل سوريا 🇸🇾</h2>
              <p className="mt-2 max-w-xl text-xs leading-6 text-white/82 sm:text-sm sm:leading-7">
                افتح الدليل الكامل للجامعات والمشافي والجهات الحكومية والمعالم الأثرية والسياحية والخرائط.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/18 pt-4">
              <span className="text-[10px] font-bold text-white/74 sm:text-xs">
                صفحة مستقلة · صور · تفاصيل مطوية · اتجاهات
              </span>
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-market-navy shadow-sm transition group-hover:-translate-x-1">
                <ChevronLeft className="size-5" aria-hidden />
              </span>
            </div>
          </div>
        </Link>

        <div
          id="student-assistant"
          className="rounded-[1.6rem] border border-border bg-card p-4 shadow-[0_10px_34px_rgb(15_23_42/0.08)] sm:p-5"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-market-navy text-white">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <div>
              <span className="text-[10px] font-black text-primary">مستقل عن دليل سوريا</span>
              <h2 className="mt-0.5 text-lg font-black text-foreground sm:text-xl">مساعد الطالب</h2>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground sm:text-xs">
                الصق فقرة أو درسًا للحصول على تلخيص منظم أو أسئلة مراجعة مباشرة.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStudyMode("summary")}
              className={
                studyMode === "summary"
                  ? "rounded-xl bg-market-navy px-3 py-2.5 text-xs font-black text-white"
                  : "rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-black text-muted-foreground"
              }
            >
              <FileText className="mx-auto mb-1 size-4" aria-hidden />
              تلخيص
            </button>
            <button
              type="button"
              onClick={() => setStudyMode("questions")}
              className={
                studyMode === "questions"
                  ? "rounded-xl bg-market-navy px-3 py-2.5 text-xs font-black text-white"
                  : "rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-black text-muted-foreground"
              }
            >
              <ListChecks className="mx-auto mb-1 size-4" aria-hidden />
              أسئلة مراجعة
            </button>
          </div>

          <label className="mt-3 block" htmlFor="student-assistant-text">
            <span className="sr-only">نص الدرس</span>
            <textarea
              id="student-assistant-text"
              value={studyText}
              onChange={(event) => setStudyText(event.target.value)}
              placeholder="الصق نص الدرس هنا…"
              className="min-h-28 w-full resize-y rounded-2xl border border-input bg-background p-3 text-sm leading-6 outline-none transition focus:border-market-navy focus:ring-2 focus:ring-market-navy/15"
            />
          </label>

          {studyResult.length > 0 ? (
            <div className="mt-3 rounded-2xl bg-muted/45 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-black text-foreground">
                <BookOpen className="size-4 text-market-navy" aria-hidden />
                النتيجة
              </div>
              <ol className="space-y-2 text-xs leading-6 text-muted-foreground">
                {studyResult.map((item, index) => (
                  <li key={`${item}-${index}`} className="rounded-xl bg-background px-3 py-2">
                    {item}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          <p className="mt-3 text-[9px] leading-5 text-muted-foreground sm:text-[10px]">
            الأداة ترتب النص الذي تدخله ولا تستبدل المعلم أو المرجع الأكاديمي.
          </p>
        </div>
      </div>
    </section>
  );
}
