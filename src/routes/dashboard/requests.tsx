import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { DashboardShell } from "@/components/marketplace/DashboardShell";

export const Route = createFileRoute("/dashboard/requests")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "طلبات عروض السعر — سوق تحقّق" },
      { name: "description", content: "متابعة طلبات عروض السعر التي أرسلتها أو استلمتها في سوق تحقّق." },
      { property: "og:title", content: "طلبات عروض السعر — سوق تحقّق" },
      { property: "og:description", content: "إدارة طلبات عروض السعر." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RequestsPage,
});

function RequestsPage() {
  const { t } = useI18n();
  const rows = useQuery({
    queryKey: ["mkt", "quotes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("mkt_quote_requests")
        .select("id, title, description, city, quantity, unit, budget, status, created_at, listing_id")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <DashboardShell title={t("market.dash.requests")}>
      <ul className="space-y-3">
        {(rows.data ?? []).map((r) => (
          <li key={r.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{r.title}</p>
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
                {t(`market.dash.quoteStatus.${r.status}`)}
              </span>
            </div>
            {r.description && <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>}
            <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
              {new Date(r.created_at).toLocaleDateString("en-GB", { timeZone: "Asia/Riyadh" })}
              {r.city ? ` · ${r.city}` : ""}
            </p>
          </li>
        ))}
      </ul>
      {!rows.isLoading && (rows.data ?? []).length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">{t("market.dash.noRequests")}</p>
      )}
    </DashboardShell>
  );
}
