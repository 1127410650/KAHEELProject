import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { PageHeader } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { MobileCards, MobileEmpty, RecordCard } from "@/components/RecordCard";

import { Button } from "@/components/ui/button";
import { formatDate, formatMoney, pickName } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/my-custody")({
  head: () => ({
    meta: [
      { title: "عهدتي — تحقّق | My custody — Tahqaq" },
      {
        name: "description",
        content: "رصيد عهدتك وحركاتها المعتمدة فقط، مع إمكانية طلب إضافة رصيد.",
      },
      { property: "og:title", content: "عهدتي — تحقّق" },
      { property: "og:description", content: "Your custody balance and approved movements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyCustodyPage,
});

function MyCustodyPage() {
  const { t, locale } = useI18n();
  const { supervisorId, isSupervisor, can } = useSession();

  const canView = can("custody.view_own");

  const { data: balance = 0 } = useQuery({
    queryKey: ["my-custody", "balance", supervisorId],
    enabled: !!supervisorId && canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custody_balances")
        .select("balance")
        .eq("supervisor_id", supervisorId!)
        .maybeSingle();
      if (error) throw error;
      return Number(data?.balance ?? 0);
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["my-custody", "txns", supervisorId],
    enabled: !!supervisorId && canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custody_transactions")
        .select("id, serial_no, txn_type, amount, txn_date, status, notes_ar, notes_en, reason, projects(code, name_ar, name_en), requests(request_no)")
        .eq("supervisor_id", supervisorId!)
        .is("deleted_at", null)
        .order("serial_no", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!canView) {
    return (
      <>
        <PageHeader title={t("portal.myCustody")} />
        <div className="surface p-10 text-center text-muted-foreground">
          {t("custody.noPermission")}
        </div>
      </>
    );
  }

  if (!isSupervisor || !supervisorId) {
    return (
      <>
        <PageHeader title={t("portal.myCustody")} />
        <div className="surface p-10 text-center text-muted-foreground">
          {t("portal.notSupervisor")}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("portal.myCustody")}
        description={t("portal.custodyDescription")}
        actions={
          <Button asChild variant="outline">
            <Link to="/portal">{t("portal.newRequest")}</Link>
          </Button>
        }
      />

      <div className="surface mb-6 flex items-center gap-4 p-5">
        <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
          <Wallet className="size-5" aria-hidden />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{t("portal.myBalance")}</p>
          <p className="num text-xl font-bold">{formatMoney(balance, locale)}</p>
        </div>
      </div>

      <MobileCards>
        {rows.length === 0 && <MobileEmpty>{t("custody.empty")}</MobileEmpty>}
        {rows.map((r) => (
          <RecordCard
            key={r.id}
            lead={`#${r.serial_no}`}
            title={t(`custody.types.${r.txn_type}`)}
            subtitle={(locale === "ar" ? r.notes_ar : r.notes_en) ?? r.reason ?? undefined}
            badge={<StatusBadge status={r.status} />}
            fields={[
              { label: t("common.amount"), value: formatMoney(r.amount, locale), num: true },
              { label: t("custody.txnDate"), value: formatDate(r.txn_date), num: true },
              {
                label: t("nav.projects"),
                value: r.projects
                  ? `${r.projects.code} ${pickName(locale, r.projects.name_ar, r.projects.name_en)}`
                  : "—",
                wide: true,
              },
              {
                label: t("common.reference"),
                value: r.requests?.request_no ?? "—",
                num: true,
                wide: true,
              },
            ]}
          />
        ))}
      </MobileCards>

      <div className="surface hidden overflow-hidden sm:block">
        <div className="overflow-x-auto">

          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 text-start font-semibold">{t("custody.serial")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("custody.type")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("common.amount")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("custody.txnDate")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("nav.projects")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("common.reference")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("common.status")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("common.notes")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    {t("custody.empty")}
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-secondary/40">
                  <td className="num px-4 py-3 font-medium">{r.serial_no}</td>
                  <td className="px-4 py-3">{t(`custody.types.${r.txn_type}`)}</td>
                  <td className="num px-4 py-3">{formatMoney(r.amount, locale)}</td>
                  <td className="num px-4 py-3">{formatDate(r.txn_date)}</td>
                  <td className="px-4 py-3">
                    {r.projects
                      ? `${r.projects.code} ${pickName(locale, r.projects.name_ar, r.projects.name_en)}`
                      : "—"}
                  </td>
                  <td className="num px-4 py-3">{r.requests?.request_no ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="max-w-56 truncate px-4 py-3 text-muted-foreground">
                    {(locale === "ar" ? r.notes_ar : r.notes_en) ?? r.reason ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
