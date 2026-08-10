import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  ChevronRight,
  FileText,
  GraduationCap,
  ListChecks,
  MessageCircleQuestion,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";

import { MarketShell } from "@/components/marketplace/MarketShell";
import { createStudyQuestions, summarizeLocally } from "@/lib/syria-directory";
import { canonicalLinks, canonicalMeta } from "@/lib/share-links";

export const Route = createFileRoute("/guides/students")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "دليل الطالب — كَحيل" },
      {
        name: "description",
        content: "أدوات مجانية للطالب السوري لتلخيص النصوص وإنشاء أسئلة مراجعة محليًا.",
      },
      { name: "robots", content: "index, follow" },
      ...canonicalMeta("/guides/students"),
    ],
    links: canonicalLinks("/guides/students"),
  }),
  component: StudentToolsPage,
});

type StudyMode = "summary" | "questions";

function StudentToolsPage() {
  const [studyText, setStudyText] = useState("");
  const [studyMode, setStudyMode] = useState<StudyMode>("summary");

  const studyResult = useMemo(() => {
    const value = studyText.trim();
    if (!value) return [];
    return studyMode === "summary" ? summarizeLocally(value, 4) : createStudyQuestions(value, 6);
  }, [studyMode, studyText]);

  return (
    <MarketShell>
      <main className="min-h-screen bg-[linear-gradient(180deg,var(--secondary)_0%,var(--background)_24rem)] pb-8">
        <section className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
          <Link
            to="/"
            className="mb-4 inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-card px-3 text-[10px] font-black text-muted-foreground shadow-sm sm:text-xs"
          >
            <ChevronRight className="size-3.5" aria-hidden />
            العودة إلى المتجر
          </Link>

          <div className="overflow-hidden rounded-[1.6rem] border border-border bg-card shadow-panel">
            <div className="relative overflow-hidden border-b border-border bg-background px-5 py-6 text-foreground sm:px-7 sm:py-8">
              <div className="relative flex items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-border bg-accent text-primary">
                  <GraduationCap className="size-6" aria-hidden />
                </span>
                <div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-primary sm:text-xs">
                    <Sparkles className="size-3.5" aria-hidden />
                    خدمة مجانية للطالب السوري
                  </span>
                  <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                    دليل الطالب
                  </h1>
                  <p className="mt-2 max-w-xl text-xs leading-6 text-muted-foreground sm:text-sm sm:leading-7">
                    الصق فقرة أو درسًا للحصول على تلخيص منظم أو أسئلة مراجعة مباشرة، دون إرسال النص
                    إلى خدمة مدفوعة.
                  </p>
                </div>

              </div>
            </div>

            <div className="border-b border-border p-4 sm:p-6">
              <Link
                to="/guides/students/assistant"
                className="flex items-center gap-3 rounded-2xl border border-accent/45 bg-accent/8 p-3 text-start"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
                  <MessageCircleQuestion className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-black text-foreground">مساعد الطالب</span>
                  <span className="mt-0.5 block text-[11px] leading-5 text-muted-foreground">
                    اسأل عن أي مسألة، أو ارفع صورة السؤال — شرح خطوة بخطوة، ٥ أسئلة مجانية يوميًا.
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 rotate-180 text-muted-foreground" aria-hidden />
              </Link>
            </div>

            <div className="p-4 sm:p-6">

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStudyMode("summary")}
                  aria-pressed={studyMode === "summary"}
                  className={
                    studyMode === "summary"
                      ? "rounded-xl bg-market-navy px-3 py-3 text-xs font-black text-white shadow-sm"
                      : "rounded-xl border border-border bg-background px-3 py-3 text-xs font-black text-muted-foreground"
                  }
                >
                  <FileText className="mx-auto mb-1 size-4" aria-hidden />
                  تلخيص
                </button>
                <button
                  type="button"
                  onClick={() => setStudyMode("questions")}
                  aria-pressed={studyMode === "questions"}
                  className={
                    studyMode === "questions"
                      ? "rounded-xl bg-market-navy px-3 py-3 text-xs font-black text-white shadow-sm"
                      : "rounded-xl border border-border bg-background px-3 py-3 text-xs font-black text-muted-foreground"
                  }
                >
                  <ListChecks className="mx-auto mb-1 size-4" aria-hidden />
                  أسئلة مراجعة
                </button>
              </div>

              <label className="mt-4 block" htmlFor="student-tools-text">
                <span className="mb-1.5 block text-xs font-black text-foreground">نص الدرس</span>
                <textarea
                  id="student-tools-text"
                  value={studyText}
                  onChange={(event) => setStudyText(event.target.value)}
                  placeholder="الصق نص الدرس هنا…"
                  className="min-h-40 w-full resize-y rounded-2xl border border-input bg-background p-3 text-sm leading-7 outline-none transition focus:border-market-navy focus:ring-2 focus:ring-market-navy/15"
                />
              </label>

              {studyResult.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-border bg-muted/45 p-3 sm:p-4">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-black text-foreground">
                    <BookOpen className="size-4 text-market-navy" aria-hidden />
                    النتيجة
                  </div>
                  <ol className="space-y-2 text-xs leading-6 text-muted-foreground sm:text-sm">
                    {studyResult.map((item, index) => (
                      <li key={`${item}-${index}`} className="rounded-xl bg-background px-3 py-2.5">
                        {item}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-border bg-muted/25 px-4 py-7 text-center">
                  <BookOpen className="mx-auto size-6 text-muted-foreground" aria-hidden />
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    ستظهر النتيجة هنا بعد لصق النص.
                  </p>
                </div>
              )}

              <p className="mt-4 text-[9px] leading-5 text-muted-foreground sm:text-[10px]">
                الأداة ترتب النص الذي تدخله ولا تستبدل المعلم أو المرجع الأكاديمي.
              </p>
            </div>
          </div>
        </section>
      </main>
    </MarketShell>
  );
}
