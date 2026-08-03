import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { BusinessQuickCreate } from "@/components/marketplace/BusinessQuickCreate";
import { isSafeInternalPath } from "@/lib/safe-next";
import { clearUnsaved, markUnsaved } from "@/lib/unsaved-changes";

interface NewBizSearch {
  next?: string | undefined;
}

const DIRTY_KEY = "business-new";

/**
 * Standalone "create a business" screen.
 *
 * Reached from the account picker as a secondary action — never as a modal on top
 * of it. Creating a business does NOT change the active account: the user returns
 * to the picker and chooses it explicitly.
 */
export const Route = createFileRoute("/business/new")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): NewBizSearch => {
    const raw = search["next"];
    return typeof raw === "string" && isSafeInternalPath(raw) ? { next: raw } : {};
  },
  head: () => ({
    meta: [
      { title: "إنشاء منشأة جديدة — سوق تحقّق" },
      {
        name: "description",
        content:
          "أنشئ منشأة جديدة في سوق تحقّق: البيانات النظامية، الموظف المختص، ثم إرسال مستندات التوثيق.",
      },
      { property: "og:title", content: "إنشاء منشأة جديدة — سوق تحقّق" },
      { property: "og:description", content: "إضافة منشأة إلى حسابك في سوق تحقّق." },
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
  const next = isSafeInternalPath(rawNext) ? rawNext : undefined;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      const back = `/business/new${next ? `?next=${encodeURIComponent(next)}` : ""}`;
      void navigate({ href: `/auth?next=${encodeURIComponent(back)}`, replace: true });
    }
  }, [loading, session, navigate, next]);

  // Nothing sensitive is persisted anywhere: the wizard lives in page state only,
  // so leaving the page loses it — warn only while something is unsaved.
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

  function backToPicker(created?: string) {
    void navigate({
      to: "/choose-account",
      search: { ...(next ? { next } : {}), ...(created ? { created } : {}) },
      replace: true,
    });
  }

  return (
    <div className="mx-auto w-full max-w-xl px-3 py-6 sm:py-10 lg:max-w-3xl">
      <p className="mb-3 text-[11px] text-muted-foreground">
        <Link
          to="/choose-account"
          search={{ ...(next ? { next } : {}) }}
          className="inline-flex items-center gap-1 underline"
        >
          <ArrowUpRight className="size-3.5" aria-hidden />
          {t("market.entry.backToAccounts")}
        </Link>
      </p>

      {dirty && (
        <p className="mb-3 rounded-lg bg-secondary/50 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
          {t("market.biz.leaveWarning")}
        </p>
      )}

      <BusinessQuickCreate
        variant="page"
        open
        onOpenChange={(open) => {
          if (!open) backToPicker();
        }}
        onDirtyChange={setDirty}
        onCreated={(tenantId) => {
          // The new business appears in the picker, but the active account
          // intentionally stays unchanged — the user selects it explicitly.
          setDirty(false);
          void queryClient.invalidateQueries({ queryKey: ["mkt", "my-accounts"] });
          backToPicker(tenantId);
        }}
      />
    </div>
  );
}
