import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Building2,
  Flag,
  ListChecks,
  Megaphone,
  ShieldOff,
  Users,
} from "lucide-react";

import { useI18n } from "@/i18n";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { loadAdminOverview } from "@/lib/mkt-platform";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "إدارة المنصة — تحقّق" },
      {
        name: "description",
        content: "لوحة مدير النظام: نظرة سريعة على المستخدمين والمنشآت والإعلانات والبلاغات وطلبات التوثيق.",
      },
      { property: "og:title", content: "إدارة المنصة — تحقّق" },
      { property: "og:description", content: "لوحة مدير النظام في منصة تحقّق." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminHomePage,
});

/** Compact stat tile: a number and a label, clickable through to the matching list. */
function Stat({
  label,
  value,
  icon: Icon,
  to,
  search,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  to: string;
  search?: Record<string, string>;
}) {
  return (
    <Link
      to={to}
      search={search ?? {}}
      className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent"
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="truncate text-xs">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{value}</p>
    </Link>
  );
}

function ActionRow({
  to,
  label,
  count,
  search,
}: {
  to: string;
  label: string;
  count: number;
  search?: Record<string, string>;
}) {
  return (
    <Link
      to={to}
      search={search ?? {}}
      className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 hover:bg-accent"
    >
      <span className="min-w-0 truncate text-sm font-medium text-foreground">{label}</span>
      <span
        className={
          "shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums " +
          (count > 0 ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground")
        }
      >
        {count}
      </span>
    </Link>
  );
}

function AdminHomePage() {
  const { t } = useI18n();
  const overview = useQuery({
    queryKey: ["mkt", "admin", "overview"],
    queryFn: loadAdminOverview,
    staleTime: 30_000,
  });
  const data = overview.data;

  return (
    <AdminShell title={t("admin.console")}>
      {overview.isLoading || !data ? (
        <Skeleton className="h-56 w-full rounded-xl" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            <Stat label={t("admin.stats.users")} value={data.users} icon={Users} to="/admin/users" />
            <Stat
              label={t("admin.stats.businesses")}
              value={data.businesses}
              icon={Building2}
              to="/admin/businesses"
            />
            <Stat
              label={t("admin.stats.published")}
              value={data.listings_published}
              icon={Megaphone}
              to="/admin/listings"
              search={{ status: "published" }}
            />
            <Stat
              label={t("admin.stats.pending")}
              value={data.listings_pending}
              icon={Megaphone}
              to="/admin/listings"
              search={{ status: "pending" }}
            />
            <Stat
              label={t("admin.stats.reports")}
              value={data.reports_new}
              icon={Flag}
              to="/admin/listing-reports"
              search={{ status: "new" }}
            />
            <Stat
              label={t("admin.stats.verifications")}
              value={data.verifications_pending}
              icon={BadgeCheck}
              to="/admin/verifications"
              search={{ status: "pending" }}
            />
            <Stat
              label={t("admin.stats.restricted")}
              value={data.restricted_accounts}
              icon={ShieldOff}
              to="/admin/users"
              search={{ restricted: "1" }}
            />
            <Stat
              label={t("admin.stats.suggestions")}
              value={data.activity_suggestions}
              icon={ListChecks}
              to="/admin/activities"
              search={{ tab: "suggestions" }}
            />

          </div>

          <section className="mt-6 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold text-foreground">{t("admin.actionNeeded")}</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <ActionRow
                to="/admin/listings"
                label={t("admin.alerts.listingsPending")}
                count={data.listings_pending}
              />
              <ActionRow
                to="/admin/listing-reports"
                label={t("admin.alerts.reportsNew")}
                count={data.reports_new}
              />
              <ActionRow
                to="/admin/verifications"
                label={t("admin.alerts.verifications")}
                count={data.verifications_pending}
              />
              <ActionRow
                to="/admin/activities"
                label={t("admin.alerts.activitySuggestions")}
                count={data.activity_suggestions}
              />
            </div>
          </section>
        </>
      )}
    </AdminShell>
  );
}
