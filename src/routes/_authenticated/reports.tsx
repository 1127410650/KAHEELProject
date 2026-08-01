import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Printer } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { PageHeader } from "@/components/AppLayout";
import { PrintPortal } from "@/components/PrintPortal";
import { MobileCards, MobileEmpty, RecordCard } from "@/components/RecordCard";

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

interface BalanceRow {
  supervisor_id: string;
  name_ar: string | null;
  name_en: string | null;
  balance: number | string | null;
}

interface ProjectRow {
  label: string;
  inTotal: number;
  outTotal: number;
}

export interface InvoiceGroupRow {
  label: string;
  count: number;
  beforeTax: number;
  tax: number;
  total: number;
  settled: number;
}

function InvoiceGroupTable({ title, rows }: { title: string; rows: InvoiceGroupRow[] }) {
  const { t, locale } = useI18n();
  const totals = rows.reduce(
    (acc, r) => ({
      count: acc.count + r.count,
      beforeTax: acc.beforeTax + r.beforeTax,
      tax: acc.tax + r.tax,
      total: acc.total + r.total,
      settled: acc.settled + r.settled,
    }),
    { count: 0, beforeTax: 0, tax: 0, total: 0, settled: 0 },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <MobileCards className="p-3">
          {rows.length === 0 && <MobileEmpty>{t("common.noData")}</MobileEmpty>}
          {rows.map((row) => (
            <RecordCard
              key={row.label}
              title={row.label}
              fields={[
                { label: t("reports.invoicesCount"), value: row.count, num: true },
                {
                  label: t("invoices.totalAmount"),
                  value: formatMoney(row.total, locale),
                  num: true,
                },
                {
                  label: t("reports.beforeTaxTotal"),
                  value: formatMoney(row.beforeTax, locale),
                  num: true,
                },
                { label: t("reports.taxTotal"), value: formatMoney(row.tax, locale), num: true },
                {
                  label: t("reports.settledTotal"),
                  value: formatMoney(row.settled, locale),
                  num: true,
                  wide: true,
                },
              ]}
            />
          ))}
          {rows.length > 0 && (
            <li className="surface flex items-center justify-between p-3 text-[12px] font-semibold">
              <span>{t("common.total")}</span>
              <span className="num text-primary">{formatMoney(totals.total, locale)}</span>
            </li>
          )}
        </MobileCards>
        <div className="hidden overflow-x-auto sm:block">

          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-start font-semibold">{t("common.details")}</th>
                <th className="px-4 py-2 text-end font-semibold">{t("reports.invoicesCount")}</th>
                <th className="px-4 py-2 text-end font-semibold">{t("reports.beforeTaxTotal")}</th>
                <th className="px-4 py-2 text-end font-semibold">{t("reports.taxTotal")}</th>
                <th className="px-4 py-2 text-end font-semibold">{t("invoices.totalAmount")}</th>
                <th className="px-4 py-2 text-end font-semibold">{t("reports.settledTotal")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {t("common.noData")}
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.label}>
                  <td className="px-4 py-3">{row.label}</td>
                  <td className="num px-4 py-3 text-end">{row.count}</td>
                  <td className="num px-4 py-3 text-end">{formatMoney(row.beforeTax, locale)}</td>
                  <td className="num px-4 py-3 text-end">{formatMoney(row.tax, locale)}</td>
                  <td className="num px-4 py-3 text-end font-semibold">
                    {formatMoney(row.total, locale)}
                  </td>
                  <td className="num px-4 py-3 text-end text-success">
                    {formatMoney(row.settled, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-secondary/60">
                <tr>
                  <td className="px-4 py-3 font-semibold">{t("common.total")}</td>
                  <td className="num px-4 py-3 text-end font-semibold">{totals.count}</td>
                  <td className="num px-4 py-3 text-end font-semibold">
                    {formatMoney(totals.beforeTax, locale)}
                  </td>
                  <td className="num px-4 py-3 text-end font-semibold">
                    {formatMoney(totals.tax, locale)}
                  </td>
                  <td className="num px-4 py-3 text-end font-bold text-primary">
                    {formatMoney(totals.total, locale)}
                  </td>
                  <td className="num px-4 py-3 text-end font-semibold text-success">
                    {formatMoney(totals.settled, locale)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function InvoiceReports({
  bySupplier,
  byProject,
}: {
  bySupplier: InvoiceGroupRow[];
  byProject: InvoiceGroupRow[];
}) {
  const { t } = useI18n();
  return (
    <div className="grid gap-4">
      <InvoiceGroupTable title={t("reports.invoicesBySupplier")} rows={bySupplier} />
      <InvoiceGroupTable title={t("reports.invoicesByProject")} rows={byProject} />
    </div>
  );
}


function ReportTables({
  balances,
  byProject,
  total,
}: {
  balances: BalanceRow[];
  byProject: ProjectRow[];
  total: number;
}) {
  const { t, locale } = useI18n();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("reports.custodyBySupervisor")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <MobileCards className="p-3">
            {balances.length === 0 && <MobileEmpty>{t("common.noData")}</MobileEmpty>}
            {balances.map((row) => (
              <li
                key={row.supervisor_id}
                className="surface flex min-w-0 items-center justify-between gap-2 p-3"
              >
                <span className="min-w-0 flex-1 wrap-anywhere text-[13px] font-medium">
                  {pickName(locale, row.name_ar, row.name_en)}
                </span>
                <span className="num shrink-0 text-[13px] font-bold">
                  {formatMoney(row.balance, locale)}
                </span>
              </li>
            ))}
            {balances.length > 0 && (
              <li className="surface flex items-center justify-between p-3 text-[12px] font-semibold">
                <span>{t("common.total")}</span>
                <span className="num text-primary">{formatMoney(total, locale)}</span>
              </li>
            )}
          </MobileCards>
          <table className="hidden w-full text-sm sm:table">

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
          <MobileCards className="p-3">
            {byProject.length === 0 && <MobileEmpty>{t("common.noData")}</MobileEmpty>}
            {byProject.map((row) => (
              <RecordCard
                key={row.label}
                title={row.label}
                fields={[
                  { label: t("custody.totalIn"), value: formatMoney(row.inTotal, locale), num: true },
                  {
                    label: t("custody.totalOut"),
                    value: formatMoney(row.outTotal, locale),
                    num: true,
                  },
                  {
                    label: t("reports.netTotal"),
                    value: formatMoney(row.inTotal - row.outTotal, locale),
                    num: true,
                    wide: true,
                  },
                ]}
              />
            ))}
          </MobileCards>
          <table className="hidden w-full text-sm sm:table">

            <thead className="bg-secondary/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-6 py-2 text-start font-semibold">{t("custody.project")}</th>
                <th className="px-6 py-2 text-end font-semibold">{t("custody.totalIn")}</th>
                <th className="px-6 py-2 text-end font-semibold">{t("custody.totalOut")}</th>
                <th className="px-6 py-2 text-end font-semibold">{t("reports.netTotal")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {byProject.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
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
                  <td className="num px-6 py-3 text-end font-semibold">
                    {formatMoney(row.inTotal - row.outTotal, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportsPage() {
  const { t, locale, dir } = useI18n();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: balances = [] } = useQuery({
    queryKey: ["custody-balances"],
    queryFn: async () => {
      const { data, error } = await supabase.from("custody_balances").select("*");
      if (error) throw error;
      return data as BalanceRow[];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, code, name_ar, name_en")
        .is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  const { data: byProject = [] } = useQuery({
    queryKey: ["report-by-project", from, to, projects.length],
    queryFn: async () => {
      let request = supabase
        .from("custody_txn_effects")
        .select("project_id, signed_amount")
        .eq("status", "approved")
        .is("deleted_at", null);
      if (from) request = request.gte("txn_date", from);
      if (to) request = request.lte("txn_date", to);
      const { data, error } = await request;
      if (error) throw error;

      const projectLabel = new Map(
        projects.map((p) => [p.id, `${p.code} — ${pickName(locale, p.name_ar, p.name_en)}`]),
      );
      const map = new Map<string, ProjectRow>();
      for (const row of data ?? []) {
        const label = (row.project_id && projectLabel.get(row.project_id)) || "—";
        const entry = map.get(label) ?? { label, inTotal: 0, outTotal: 0 };
        const net = Number(row.signed_amount ?? 0);
        if (net >= 0) entry.inTotal += net;
        else entry.outTotal += -net;
        map.set(label, entry);
      }
      return [...map.values()].sort((a, b) => b.inTotal - a.inTotal);
    },
  });

  const { data: invoiceGroups = { bySupplier: [], byProject: [] } } = useQuery({
    queryKey: ["report-invoices", from, to, locale],
    queryFn: async () => {
      let request = supabase
        .from("invoices")
        .select(
          "id, amount_before_tax, tax_amount, total_amount, status, supplier_id, project_id, suppliers(name_ar, name_en), projects(code, name_ar, name_en)",
        )
        .is("deleted_at", null)
        .neq("status", "cancelled");
      if (from) request = request.gte("invoice_date", from);
      if (to) request = request.lte("invoice_date", to);
      const [{ data, error }, { data: effects, error: effectsError }] = await Promise.all([
        request,
        supabase
          .from("custody_txn_effects")
          .select("invoice_id, reversal_of_invoice_id, signed_amount")
          .eq("status", "approved")
          .is("deleted_at", null),
      ]);
      if (error) throw error;
      if (effectsError) throw effectsError;

      const settled = new Map<string, number>();
      for (const row of effects ?? []) {
        const key = row.invoice_id ?? row.reversal_of_invoice_id;
        if (!key) continue;
        settled.set(key, (settled.get(key) ?? 0) + -Number(row.signed_amount ?? 0));
      }

      type InvoiceRow = NonNullable<typeof data>[number];
      const group = (keyOf: (row: InvoiceRow) => string) => {
        const map = new Map<string, InvoiceGroupRow>();
        for (const row of data ?? []) {
          const label = keyOf(row);
          const entry =
            map.get(label) ??
            ({ label, count: 0, beforeTax: 0, tax: 0, total: 0, settled: 0 } as InvoiceGroupRow);
          entry.count += 1;
          entry.beforeTax += Number(row.amount_before_tax ?? 0);
          entry.tax += Number(row.tax_amount ?? 0);
          entry.total += Number(row.total_amount ?? 0);
          entry.settled += settled.get(row.id) ?? 0;
          map.set(label, entry);
        }
        return [...map.values()].sort((a, b) => b.total - a.total);
      };

      return {
        bySupplier: group((row) => {
          const supplier = row.suppliers as { name_ar?: string; name_en?: string } | null;
          return pickName(locale, supplier?.name_ar, supplier?.name_en);
        }),
        byProject: group((row) => {
          const project = row.projects as {
            code?: string;
            name_ar?: string;
            name_en?: string;
          } | null;
          return project
            ? `${project.code} — ${pickName(locale, project.name_ar, project.name_en)}`
            : "—";
        }),
      };
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

      <div className="space-y-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40 space-y-2">
            <Label htmlFor="from">{t("reports.from")}</Label>
            <Input
              id="from"
              type="date"
              lang="en-GB"
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
              lang="en-GB"
              dir="ltr"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>

        <ReportTables balances={balances} byProject={byProject} total={total} />
        <InvoiceReports
          bySupplier={invoiceGroups.bySupplier}
          byProject={invoiceGroups.byProject}
        />
      </div>

      <PrintPortal>
        <div dir={dir} lang={locale} className="voucher-sheet space-y-6">
          <header className="border-b border-border pb-4">
            <h2 className="text-xl font-bold">{t("app.name")}</h2>
            <p className="mt-1 text-sm">{t("reports.title")}</p>
          </header>
          <ReportTables balances={balances} byProject={byProject} total={total} />
          <InvoiceReports
            bySupplier={invoiceGroups.bySupplier}
            byProject={invoiceGroups.byProject}
          />
        </div>
      </PrintPortal>
    </>
  );
}
