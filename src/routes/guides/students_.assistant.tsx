import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, GraduationCap } from "lucide-react";

import { MarketShell } from "@/components/marketplace/MarketShell";
import { StudentBotChat } from "@/components/marketplace/student/StudentBotChat";
import { canonicalLinks, canonicalMeta } from "@/lib/share-links";

export const Route = createFileRoute("/guides/students_/assistant")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "مساعد الطالب — كَحيل" },
      {
        name: "description",
        content:
          "مساعد دراسي لطلاب التاسع والبكالوريا في سوريا: اشرح سؤالك أو ارفع صورته واحصل على حل خطوة بخطوة.",
      },
      { property: "og:title", content: "مساعد الطالب — كَحيل" },
      {
        property: "og:description",
        content: "٥ أسئلة مجانية يوميًا لكل طالب، وشرح خطوة بخطوة بالعربية.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "مساعد الطالب — كَحيل" },
      {
        name: "twitter:description",
        content: "مساعد دراسي لطلاب التاسع والبكالوريا في سوريا.",
      },
      { name: "robots", content: "index, follow" },
      ...canonicalMeta("/guides/students/assistant"),
    ],
    links: canonicalLinks("/guides/students/assistant"),
  }),
  component: StudentAssistantPage,
});

function StudentAssistantPage() {
  return (
    <MarketShell>
      <main className="min-h-screen bg-[linear-gradient(180deg,var(--secondary)_0%,var(--background)_20rem)] pb-10">
        <section className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-7">
          <Link
            to="/guides/students"
            className="mb-3 inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-card px-3 text-desc font-black text-muted-foreground shadow-sm sm:text-desc"
          >
            <ChevronRight className="size-3.5" aria-hidden />
            دليل الطالب
          </Link>

          <header className="mb-3 flex items-center gap-2">
            <span className="grid size-10 shrink-0 place-items-center rounded-[var(--r-card)] bg-primary/12 text-primary">
              <GraduationCap className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-page truncate font-black text-foreground">
                مساعد الطالب
              </h1>
              <p className="text-desc text-muted-foreground">
                التاسع والبكالوريا — شرح خطوة بخطوة بالعربية
              </p>
            </div>
          </header>

          <StudentBotChat />
        </section>
      </main>
    </MarketShell>
  );
}
