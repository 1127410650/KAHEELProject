import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { BusinessQuickCreate } from "@/components/marketplace/BusinessQuickCreate";
import { isSafeInternalPath, safeInternalPath } from "@/lib/safe-next";
import { clearUnsaved, markUnsaved } from "@/lib/unsaved-changes";

interface NewStoreSearch {
  next?: string | undefined;
}

const DIRTY_KEY = "store-new";

/**
 * Public store-creation page. The internal tenant model remains unchanged for
 * permissions and isolation, while the public product language is consistently
 * "store". Creating a store never opens an account picker.
 */
export const Route = createFileRoute("/business/new")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): NewStoreSearch => {
    const raw = search["next"];
    return typeof raw === "string" && isSafeInternalPath(raw) ? { next: raw } : {};
  },
  head: () => ({
    meta: [
      { title: "إنشاء متجر جديد — سوق تحقّق" },
      {
        name: "description",
        content: "أنشئ متجرًا لعرض منتجاتك وإدارة إعلاناتك في سوق تحقّق.",
      },
      { property: "og:title", content: "إنشاء متجر جديد — سوق تحقّق" },
      { property: "og:description", content: "إضافة متجر إلى حسابك في سوق تحقّق." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewStorePage,
});

function NewStorePage() {
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
    <div className="market-surface mx-auto w-full max-w-xl px-3 py-6 sm:py-10 lg:max-w-3xl">
      <p className="mb-3 text-[11px] text-muted-foreground">
        <Link to="/more" className="inline-flex items-center gap-1 underline">
          <ArrowUpRight className="size-3.5" aria-hidden />
          العودة إلى المزيد
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
  );
}
