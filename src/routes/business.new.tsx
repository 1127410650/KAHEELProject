import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { BusinessQuickCreate } from "@/components/marketplace/BusinessQuickCreate";
import {
  SelectedStoreTemplate,
  StoreTemplatePicker,
  STORE_TEMPLATES,
  type StoreTemplate,
  type StoreTemplateId,
} from "@/components/marketplace/StoreTemplatePicker";
import { isSafeInternalPath, safeInternalPath } from "@/lib/safe-next";
import { clearUnsaved, markUnsaved } from "@/lib/unsaved-changes";

interface NewStoreSearch {
  next?: string | undefined;
}

const DIRTY_KEY = "store-new";
const TEMPLATE_KEY = "tahqaq.store-template";

/**
 * Public store-creation page. The first step is always template selection; the
 * existing verified store wizard opens only after the user chooses a visual
 * identity. The internal tenant model remains unchanged for permissions and
 * isolation.
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
        content: "اختر قالب متجرك ثم أدخل بياناته لعرض منتجاتك وإدارة إعلاناتك في سوق تحقّق.",
      },
      { property: "og:title", content: "إنشاء متجر جديد — سوق تحقّق" },
      { property: "og:description", content: "قوالب متاجر متعددة حسب النشاط والجمهور." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewStorePage,
});

function readStoredTemplate(): StoreTemplateId | null {
  if (typeof window === "undefined") return null;
  const value = window.sessionStorage.getItem(TEMPLATE_KEY) as StoreTemplateId | null;
  return STORE_TEMPLATES.some((template) => template.id === value) ? value : null;
}

function NewStorePage() {
  const { t } = useI18n();
  const { session, loading } = useSession();
  const { next: rawNext } = Route.useSearch();
  const next = safeInternalPath(isSafeInternalPath(rawNext) ? rawNext : undefined);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dirty, setDirty] = useState(false);
  const [templateId, setTemplateId] = useState<StoreTemplateId | null>(() => readStoredTemplate());

  const selectedTemplate = useMemo<StoreTemplate | null>(
    () => STORE_TEMPLATES.find((template) => template.id === templateId) ?? null,
    [templateId],
  );

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

  function chooseTemplate(template: StoreTemplate) {
    setTemplateId(template.id);
    window.sessionStorage.setItem(TEMPLATE_KEY, template.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function changeTemplate() {
    setTemplateId(null);
    window.sessionStorage.removeItem(TEMPLATE_KEY);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function leave() {
    void navigate({ href: next || "/more", replace: true });
  }

  return (
    <div className="market-surface min-h-dvh px-3 py-6 sm:py-10">
      <div className={selectedTemplate ? "mx-auto w-full max-w-3xl" : "mx-auto w-full max-w-6xl"}>
        <p className="mb-3 text-[11px] text-muted-foreground">
          <Link to="/more" className="inline-flex items-center gap-1 underline">
            <ArrowUpRight className="size-3.5" aria-hidden />
            العودة إلى المزيد
          </Link>
        </p>

        {!selectedTemplate ? (
          <StoreTemplatePicker onSelect={chooseTemplate} />
        ) : (
          <>
            <SelectedStoreTemplate template={selectedTemplate} onChange={changeTemplate} />

            <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-panel">
              <p className="text-xs font-semibold text-muted-foreground">هوية المتجر</p>
              <h1 className="mt-1 text-xl font-black text-foreground">{selectedTemplate.title}</h1>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{selectedTemplate.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selectedTemplate.features.map((feature) => (
                  <span key={feature} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
                    {feature}
                  </span>
                ))}
              </div>
            </div>

            {dirty && (
              <p className="mb-3 rounded-lg bg-secondary/50 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                {t("market.biz.leaveWarning")}
              </p>
            )}

            <div className={`overflow-hidden rounded-3xl border border-border bg-card p-1 shadow-raised`}>
              <div className={`rounded-[1.35rem] bg-gradient-to-br ${selectedTemplate.gradient} p-1`}>
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
                      window.sessionStorage.removeItem(TEMPLATE_KEY);
                      void queryClient.invalidateQueries({ queryKey: ["mkt", "my-accounts"] });
                      leave();
                    }}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
