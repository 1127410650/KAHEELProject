import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowUpRight } from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { BusinessQuickCreate } from "@/components/marketplace/BusinessQuickCreate";
import { isSafeInternalPath } from "@/lib/safe-next";

interface NewBizSearch {
  next?: string | undefined;
}

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

  useEffect(() => {
    if (!loading && !session) {
      const back = `/business/new${next ? `?next=${encodeURIComponent(next)}` : ""}`;
      void navigate({ href: `/auth?next=${encodeURIComponent(back)}`, replace: true });
    }
  }, [loading, session, navigate, next]);

  function backToPicker() {
    void navigate({
      to: "/choose-account",
      search: { ...(next ? { next } : {}) },
      replace: true,
    });
  }


  return (
    <div className="mx-auto w-full max-w-xl px-3 py-6 sm:py-10 lg:max-w-2xl">
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

      <BusinessQuickCreate
        variant="page"
        open
        onOpenChange={(open) => {
          if (!open) backToPicker();
        }}
        onCreated={() => {
          // The new business appears in the picker, but the active account
          // intentionally stays unchanged — the user selects it explicitly.
          void queryClient.invalidateQueries({ queryKey: ["mkt", "my-accounts"] });
        }}
      />
    </div>
  );
}
