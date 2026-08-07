import { createFileRoute } from "@tanstack/react-router";

import {
  FormRouteError,
  FormRoutePending,
} from "@/components/marketplace/FormRouteFallback";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { LISTING_COLUMNS, type MktListing } from "@/lib/mkt";
import { useSession } from "@/lib/session";
import { useActiveAccount } from "@/lib/mkt-account";
import { Button } from "@/components/ui/button";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { ListingForm } from "@/components/marketplace/ListingForm";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/dashboard/ads/$id/edit")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تعديل الإعلان — گحيل" },
      { name: "description", content: "عدّل بيانات إعلانك وصوره وسعره ثم أعد إرساله للمراجعة." },
      { property: "og:title", content: "تعديل الإعلان — گحيل" },
      { property: "og:description", content: "تحديث تفاصيل الإعلان في گحيل." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditAdPage,
  pendingComponent: FormRoutePending,
  errorComponent: FormRouteError,
  pendingMs: 100,
  pendingMinMs: 200,
});

function EditAdPage() {
  const { id } = Route.useParams();
  const { t } = useI18n();
  const { session } = useSession();
  const { account, accounts, select } = useActiveAccount();
  const ad = useQuery({
    queryKey: ["mkt", "my-ad", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("mkt_listings")
        .select(LISTING_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      const row = (data as unknown as MktListing | null) ?? null;
      if (!row) return null;
      // The exact pin and the street address are unreadable through the table;
      // only the owner/admin path may fetch them back for editing.
      const { data: loc } = await supabase.rpc("mkt_listing_exact_location", {
        p_listing_id: id,
      });
      const exact = Array.isArray(loc) ? loc[0] : null;
      return exact ? { ...row, ...exact } : row;
    },
  });

  // A direct link may point at an ad that belongs to another account the user
  // also works under. Rather than failing, offer to switch into that account.
  const listing = ad.data;
  const belongsToActive =
    !!listing &&
    !!account &&
    (account.kind === "business"
      ? listing.tenant_id === account.tenant_id
      : !listing.tenant_id && listing.owner_user_id === session?.user.id);
  const otherAccount =
    listing && !belongsToActive
      ? (accounts.find((a) =>
          listing.tenant_id
            ? a.kind === "business" && a.tenant_id === listing.tenant_id
            : a.kind === "individual" && listing.owner_user_id === session?.user.id,
        ) ?? null)
      : null;

  return (
    <DashboardShell title={t("market.dash.edit")}>
      {ad.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : listing && belongsToActive ? (
        <ListingForm listing={listing} />
      ) : listing && otherAccount ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-foreground">
            {t("market.entry.otherAccount", {
              name: otherAccount.name || t("market.account.fallbackName"),
            })}
          </p>
          <Button
            className="mt-3"
            onClick={() => void select(otherAccount.account_key)}
          >
            {t("market.entry.switchTo", {
              name: otherAccount.name || t("market.account.fallbackName"),
            })}
          </Button>
        </div>
      ) : listing ? (
        <p className="text-sm text-muted-foreground">{t("market.entry.notYours")}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{t("market.ad.notFound")}</p>
      )}
    </DashboardShell>
  );
}
