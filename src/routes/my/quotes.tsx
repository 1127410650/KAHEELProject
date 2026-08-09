import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { useActiveAccount } from "@/lib/mkt-account";
import { DashboardShell } from "@/components/marketplace/DashboardShell";

export const Route = createFileRoute("/my/quotes")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "طلبات عروض السعر — گحيل" },
      {
        name: "description",
        content: "متابعة طلبات عروض السعر التي أرسلتها أو استلمتها في گحيل.",
      },
      { property: "og:title", content: "طلبات عروض السعر — گحيل" },
      { property: "og:description", content: "إدارة طلبات عروض السعر." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RequestsPage,
});

function RequestsPage() {
  const { t } = useI18n();
  const { session } = useSession();
  const { account } = useActiveAccount();
  const rows = useQuery({
    queryKey: ["mkt", "quotes", account?.account_key],
    enabled: !!session && !!account,
    queryFn: async () => {
      // Quote requests follow the same isolation rule as conversations.
      let query = supabase
        .from("mkt_quote_requests")
        .select(
          "id, title, description, city, quantity, unit, budget, status, created_at, listing_id",
        );
      query =
        account!.kind === "business"
          ? query.eq("seller_tenant_id", account!.tenant_id!)
          : query.or(
              `buyer_user_id.eq.${session!.user.id},and(seller_user_id.eq.${session!.user.id},seller_tenant_id.is.null)`,
            );
      const { data } = await query.order("created_at", { ascending: false });
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
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("market.dash.noRequests")}
        </p>
      )}
    </DashboardShell>
  );
}
