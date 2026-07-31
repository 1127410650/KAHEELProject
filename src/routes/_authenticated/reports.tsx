import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Printer } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, pickName } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "التقارير — تحقّق | Reports — Tahqaq" },
      { name: "description", content: "تقارير أرصدة العهد وحركاتها حسب المشرف والمشروع والفترة." },
      { property: "og:title", content: "التقارير — تحقّق" },
      { property: "og:description", content: "Custody balance and movement reports." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { t, locale } = useI18n();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: balances = [] } = useQuery({
    queryKey: ["custody-balances"],
    queryFn: async () => {
      const { data, error } = await supabase.from("custody_balances").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: byProject = [] } = useQuery({
    queryKey: ["report-by-project", from, to],
    queryFn: async () => {
      let request = supabase
        .from("custody_transactions")
        .select("amount, txn_type, projects(code, name_ar, name_en)")
        .eq("status", "approved")
        .is("deleted_at", null);
      if (from) request = request.gte("txn_date", from);
      if (to) request = request.lte("txn_date", to);
      const { data, error } = await request;
      if (error) throw error;

      const map = new Map<string, { label: string; inTotal: number; outTotal: number }>();
      for (const row of data ?? []) {
        const project = row.projects as {
          code?: string;
          name_ar?: string;
          name_en?: string;
        } | null;
        const label = project
          ? `${project.code} — ${pickName(locale, project.name_ar, project.name_en)}`
          : "—";
        const entry = map.get(label) ?? { label, inTotal: 0, outTotal: 0 };
        const amount = Number(row.amount);
        if (row.txn_type === "add" || row.txn_type === "refund") entry.inTotal += amount;
        else entry.outTotal += amount;
        map.set(label, entry);
      }
      return [...map.values()].sort((a, b) => b.inTotal - a.inTotal);
    },
  });

  const total = balances.reduce((sum, b) => sum + Number(b.balance ?? 0), 0);

  return (
    <>
      <PageHeader
        title={t("reports.title")}
        description={t("reports.description")}
        actions={
          <Button variant="outline" className="gap-2" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden />
            {t("common.print")}
          </Button>
        }
      />

      <div className="voucher-sheet space-y-6">
        <div className="flex flex-wrap items-end gap-3 print:hidden">
          <div className="w-40 space-y-2">
            <Label htmlFor="from">{t("reports.from")}</Label>
            <Input
              id="from"
              type="date"
              dir="ltr"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="w-40 space-y-2">
            <Label htmlFor="to">{t("reports.to")}</Label>
            <Input
              id="to"
              type="date"
              dir="ltr"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("reports.custodyBySupervisor")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {balances.length === 0 && (
                    <tr>
                      <td className="px-6 py-8 text-center text-muted-foreground">
                        {t("common.noData")}
                      </td>
                    </tr>
                  )}
                  {balances.map((row) => (
                    <tr key={row.supervisor_id}>
                      <td className="px-6 py-3">{pickName(locale, row.name_ar, row.name_en)}</td>
                      <td className="num px-6 py-3 text-end font-semibold">
                        {formatMoney(row.balance, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-secondary/60">
                  <tr>
                    <td className="px-6 py-3 font-semibold">{t("common.total")}</td>
                    <td className="num px-6 py-3 text-end font-bold text-primary">
                      {formatMoney(total, locale)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("reports.custodyByProject")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-6 py-2 text-start font-semibold">{t("custody.project")}</th>
                    <th className="px-6 py-2 text-end font-semibold">{t("custody.totalIn")}</th>
                    <th className="px-6 py-2 text-end font-semibold">{t("custody.totalOut")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {byProject.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">
                        {t("common.noData")}
                      </td>
                    </tr>
                  )}
                  {byProject.map((row) => (
                    <tr key={row.label}>
                      <td className="px-6 py-3">{row.label}</td>
                      <td className="num px-6 py-3 text-end text-success">
                        {formatMoney(row.inTotal, locale)}
                      </td>
                      <td className="num px-6 py-3 text-end text-destructive">
                        {formatMoney(row.outTotal, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
