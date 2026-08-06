import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight, Building2 } from "lucide-react";

import { BusinessQuickCreate } from "@/components/marketplace/BusinessQuickCreate";
import { useI18n } from "@/i18n";
import { isSafeInternalPath, safeInternalPath } from "@/lib/safe-next";
import { useSession } from "@/lib/session";
import { clearUnsaved, markUnsaved } from "@/lib/unsaved-changes";

interface NewBusinessSearch {
  next?: string | undefined;
}

const DIRTY_KEY = "business-new";

export const Route = createFileRoute("/business/new")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): NewBusinessSearch => {
    const raw = search["next"];
    return typeof raw === "string" && isSafeInternalPath(raw) ? { next: raw } : {};
  },
  head: () => ({
    meta: [
      { title: "إضافة منشأة جديدة — كَحيل" },
      {
        name: "description",
        content: "أضف بيانات منشأتك الرسمية وارفع مستندات التفويض للمراجعة داخل كَحيل.",
      },
      { property: "og:title", content: "إضافة منشأة جديدة — كَحيل" },
      { property: "og:description", content: "إنشاء ملف منشأة وربطه بصاحبه أو المفوض عنها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewBusinessPage,
});

function NewBusinessPage() {
  const { t } = useI18n();
  const { session, loading } = useSession();
  const { next: rawNext } = Route.useSearch();
  const next = safeInternalPath(isSafeInternalPath(rawNext) ? rawNext : undefined);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      const back = `/business/new?next=${encodeURIComponent(next)}`;
      void navigate({ href: `/auth?next=${encodeURIComponent(back)}`, replace: true });
    }
  }, [loading, session, navigate, next]);

  useEffect(() => {
    if (!dirty) {
      clearUnsaved(DIRTY_KEY);
      return;
    }
    markUnsaved(DIRTY_KEY);
    const onLeave = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      clearUnsaved(DIRTY_KEY);
    };
  }, [dirty]);

  function leave() {
    void navigate({ href: next || "/more", replace: true });
  }

  return (
    <div className="market-surface min-h-dvh px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-3xl">
        <p className="mb-3 text-[11px] text-muted-foreground">
          <Link to="/more" className="inline-flex items-center gap-1 underline">
            <ArrowUpRight className="size-3.5" aria-hidden />
            العودة إلى المزيد
          </Link>
        </p>

        <div className="mb-4 rounded-3xl border border-border bg-card p-5 shadow-panel sm:p-6">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Building2 className="size-5" aria-hidden />
          </span>
          <p className="mt-4 text-xs font-bold text-primary">ملف المنشأة</p>
          <h1 className="mt-1 text-2xl font-black text-foreground">أضف منشأتك الرسمية</h1>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            هذه الصفحة مخصصة لبيانات المنشأة والتفويض. اختيار هوية المتجر أصبح داخل مسار إنشاء المتجر نفسه.
          </p>
        </div>

        {dirty && (
          <p className="mb-3 rounded-xl bg-secondary/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
            {t("market.biz.leaveWarning")}
          </p>
        )}

        <div className="overflow-hidden rounded-3xl border border-border bg-card p-1 shadow-raised">
          <div className="rounded-[1.35rem] bg-gradient-to-br from-market-navy via-market-navy-dark to-primary p-1">
            <div className="rounded-[1.15rem] bg-background p-3 sm:p-5">
              <BusinessQuickCreate
                variant="page"
                open
                onOpenChange={(open) => {
                  if (!open) leave();
                }}
                onDirtyChange={setDirty}
                onCreated={() => {
                  setDirty(false);
                  void queryClient.invalidateQueries({ queryKey: ["mkt", "my-accounts"] });
                  leave();
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
