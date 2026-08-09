import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import {
  FormRouteError,
  FormRoutePending,
} from "@/components/marketplace/FormRouteFallback";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { StoreWizard } from "@/components/marketplace/store/StoreWizard";
import {
  SelectedStoreTemplate,
  StoreTemplatePicker,
  STORE_TEMPLATES,
  type StoreTemplate,
} from "@/components/marketplace/StoreTemplatePicker";
import { StoreTemplateShowcase } from "@/components/marketplace/StoreTemplateShowcase";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { useActiveAccount } from "@/lib/mkt-account";
import { useStoreDraft } from "@/lib/mkt-store";
import { saveStoreTheme } from "@/lib/mkt-store-theme";
import { isStoreThemeId, type StoreThemeId } from "@/lib/store-theme";

interface StoreNewSearch {
  theme?: StoreThemeId | undefined;
}

export const Route = createFileRoute("/business/store/new")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): StoreNewSearch => {
    const theme = search["theme"];
    return isStoreThemeId(theme) ? { theme } : {};
  },
  head: () => ({
    meta: [
      { title: "متجر جديد — گحيل" },
      {
        name: "description",
        content: "اختر هوية متجرك ثم أكمل بياناته وكتالوجه داخل گحيل.",
      },
      { property: "og:title", content: "متجر جديد — گحيل" },
      { property: "og:description", content: "أنشئ متجرًا مصغّرًا بهوية تناسب نشاطك." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewStorePage,
  pendingComponent: FormRoutePending,
  errorComponent: FormRouteError,
  pendingMs: 100,
  pendingMinMs: 200,
});

function NewStorePage() {
  const { t } = useI18n();
  return (
    <DashboardShell title={t("market.store.createTitle")}>
      <StoreThemeGate />
    </DashboardShell>
  );
}

function StoreThemeGate() {
  const { theme: requestedTheme } = Route.useSearch();
  const { account } = useActiveAccount();
  const accountKey = account?.account_key ?? null;
  const draft = useStoreDraft(accountKey);
  const queryClient = useQueryClient();
  const [choosing, setChoosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const appliedRequest = useRef<StoreThemeId | null>(null);

  const storedThemeRaw = draft.data
    ? (draft.data.store as typeof draft.data.store & { theme_id?: unknown }).theme_id
    : null;
  const storedTheme = isStoreThemeId(storedThemeRaw) ? storedThemeRaw : null;
  const selectedTemplate = useMemo(
    () => STORE_TEMPLATES.find((template) => template.id === storedTheme) ?? null,
    [storedTheme],
  );

  const chooseTheme = useCallback(
    async (template: StoreTemplate) => {
      if (!accountKey || saving) return;
      setSaving(true);
      try {
        await saveStoreTheme(accountKey, template.id);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["mkt", "store-draft", accountKey] }),
          queryClient.invalidateQueries({ queryKey: ["mkt", "my-storefront", accountKey] }),
        ]);
        setChoosing(false);
        toast.success("تم حفظ هوية المتجر");
      } catch (error) {
        toast.error((error as Error).message || "تعذر حفظ هوية المتجر");
      } finally {
        setSaving(false);
      }
    },
    [accountKey, queryClient, saving],
  );

  useEffect(() => {
    if (
      !requestedTheme ||
      !accountKey ||
      draft.isLoading ||
      saving ||
      storedTheme === requestedTheme ||
      appliedRequest.current === requestedTheme
    ) {
      return;
    }
    const template = STORE_TEMPLATES.find((item) => item.id === requestedTheme);
    if (!template) return;
    appliedRequest.current = requestedTheme;
    void chooseTheme(template);
  }, [accountKey, chooseTheme, draft.isLoading, requestedTheme, saving, storedTheme]);

  if (!accountKey) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        اختر حسابًا نشطًا أولًا لإنشاء المتجر.
      </div>
    );
  }

  if (draft.isLoading || (requestedTheme && requestedTheme !== storedTheme && saving)) {
    return <Skeleton className="h-72 w-full rounded-3xl" />;
  }

  if (!selectedTemplate || choosing) {
    return (
      <div className={saving ? "pointer-events-none opacity-70" : ""}>
        <StoreTemplatePicker onSelect={(template) => void chooseTheme(template)} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SelectedStoreTemplate template={selectedTemplate} onChange={() => setChoosing(true)} />
      <StoreTemplateShowcase template={selectedTemplate} />
      <StoreWizard />
    </div>
  );
}
