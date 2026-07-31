import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, FolderKanban, Wallet, Clock } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { PageHeader } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatMoney, formatNumber, pickName } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم — تحقّق | Dashboard — Tahqaq" },
      {
        name: "description",
        content: "نظرة عامة على المشاريع والمشرفين وأرصدة العهد في نظام تحقّق.",
      },
      { property: "og:title", content: "لوحة التحكم — تحقّق" },
      { property: "og:description", content: "Overview of projects, supervisors and custody." },
    ],
  }),
  component: DashboardPage,
});

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="surface flex items-center gap-4 p-5">
      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        <p className="num mt-1 text-xl font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function DashboardPage() {
  const { t, locale } = useI18n();

  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [supervisors, projects, balances, recent, pending] = await Promise.all([
        supabase.from("supervisors").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("projects").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("custody_balances").select("*"),
        supabase
          .from("custody_transactions")
          .select("id, serial_no, txn_type, amount, txn_date, status, supervisors(name_ar, name_en)")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("custody_transactions")
          .select("id", { count: "exact", head: true })
          .in("status", ["draft", "under_review"])
          .is("deleted_at", null),
      ]);
      return {
        supervisors: supervisors.count ?? 0,
        projects: projects.count ?? 0,
        balances: balances.data ?? [],
        recent: recent.data ?? [],
        pending: pending.count ?? 0,
      };
    },
  });

  const totalCustody = (data?.balances ?? []).reduce((sum, b) => sum + Number(b.balance ?? 0), 0);
  const topBalances = [...(data?.balances ?? [])]
    .sort((a, b) => Number(b.balance ?? 0) - Number(a.balance ?? 0))
    .slice(0, 5);

  return (
    <>
      <PageHeader title={t("dashboard.title")} description={t("dashboard.description")} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label={t("dashboard.supervisorsCount")}
          value={formatNumber(data?.supervisors)}
        />
        <StatCard
          icon={FolderKanban}
          label={t("dashboard.projectsCount")}
          value={formatNumber(data?.projects)}
        />
        <StatCard
          icon={Wallet}
          label={t("dashboard.totalCustody")}
          value={formatMoney(totalCustody, locale)}
        />
        <StatCard
          icon={Clock}
          label={t("dashboard.pendingApprovals")}
          value={formatNumber(data?.pending)}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.recentCustody")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(data?.recent ?? []).length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">{t("custody.empty")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {(data?.recent ?? []).map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
                    <span className="num text-xs text-muted-foreground">#{row.serial_no}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {pickName(
                        locale,
                        (row.supervisors as { name_ar?: string } | null)?.name_ar,
                        (row.supervisors as { name_en?: string } | null)?.name_en,
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t(`custody.types.${row.txn_type}`)}
                    </span>
                    <span className="num text-sm font-semibold text-foreground">
                      {formatMoney(row.amount, locale)}
                    </span>
                    <span className="num text-xs text-muted-foreground">
                      {formatDate(row.txn_date)}
                    </span>
                    <StatusBadge status={row.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.topBalances")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topBalances.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">{t("supervisors.empty")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {topBalances.map((row) => (
                  <li
                    key={row.supervisor_id}
                    className="flex items-center justify-between gap-3 px-6 py-3"
                  >
                    <span className="min-w-0 truncate text-sm text-foreground">
                      {pickName(locale, row.name_ar, row.name_en)}
                    </span>
                    <span className="num shrink-0 text-sm font-semibold text-primary">
                      {formatMoney(row.balance, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
