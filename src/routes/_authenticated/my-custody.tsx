import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { PageHeader } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";

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
  const { supervisorId, isSupervisor } = useSession();

  const { data: balance = 0 } = useQuery({
    queryKey: ["my-custody", "balance", supervisorId],
    enabled: !!supervisorId,
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
    enabled: !!supervisorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custody_transactions")
        .select("id, serial_no, txn_type, amount, txn_date, status, notes_ar, notes_en")
        .eq("supervisor_id", supervisorId!)
        .is("deleted_at", null)
        .order("serial_no", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

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

      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 text-start font-semibold">{t("custody.serial")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("custody.type")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("common.amount")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("custody.txnDate")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("common.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
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
                    <StatusBadge status={r.status} />
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
