/**
 * لوحة الأداء — أرقام مقيسة من متصفحات الزوار مقابل ميزانيات المنصة.
 * لا رقم تقديري: كل قيمة p75 محسوبة من أحداث `perf.web_vital` الحقيقية.
 */
import { AlertTriangle, CheckCircle2, Gauge } from "lucide-react";

import { AdminCard, AdminEmptyState, AdminTableScroll } from "@/components/admin/AdminPage";
import { formatNumber } from "@/lib/format";
import type { PerfBudgetRow, PerfSummary } from "@/lib/mkt-reliability";

function budgetFor(summary: PerfSummary, pageType = "cms"): PerfBudgetRow | undefined {
  return summary.budgets.find((b) => b.page_type === pageType) ?? summary.budgets[0];
}

function metricBudget(summary: PerfSummary, metric: string): number | null {
  const budget = budgetFor(summary);
  if (!budget) return null;
  if (metric === "LCP") return budget.lcp_ms;
  if (metric === "INP") return budget.inp_ms;
  if (metric === "CLS") return budget.cls_milli / 1000;
  return null;
}

export function PerfPanel({ summary }: { summary: PerfSummary }) {
  const budget = budgetFor(summary);

  return (
    <div className="grid gap-[var(--sp-4)]">
      <AdminCard
        title="مقاييس الويب الأساسية"
        description={`قياس حقيقي من ${formatNumber(summary.samples)} حدث خلال ${formatNumber(summary.window_days)} يوم — الميزانية من إعدادات المنصة.`}
      >
        {summary.metrics.length === 0 ? (
          <AdminEmptyState
            icon={Gauge}
            title="لا قياسات بعد"
            hint="القياس يبدأ من أول زيارة حقيقية بعد هذا التحديث — لا تُعرض أرقام تجريبية."
          />
        ) : (
          <AdminTableScroll>
            <table className="w-full text-[14px]">
              <thead className="text-start text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">المقياس</th>
                  <th className="p-2 text-start">الجهاز</th>
                  <th className="p-2 text-start">القياسات</th>
                  <th className="p-2 text-start">p75</th>
                  <th className="p-2 text-start">p95</th>
                  <th className="p-2 text-start">مقابل الميزانية</th>
                </tr>
              </thead>
              <tbody>
                {summary.metrics.map((row) => {
                  const limit = metricBudget(summary, row.metric);
                  const p75 = row.p75 === null ? null : Number(row.p75);
                  const over = limit !== null && p75 !== null && p75 > limit;
                  return (
                    <tr key={`${row.metric}-${row.device}`} className="border-t border-border">
                      <td className="p-2 font-medium text-foreground">{row.metric}</td>
                      <td className="p-2 text-muted-foreground">{row.device}</td>
                      <td className="p-2 tabular-nums">{formatNumber(Number(row.samples))}</td>
                      <td className="p-2 tabular-nums">{p75 === null ? "—" : formatNumber(p75)}</td>
                      <td className="p-2 tabular-nums text-muted-foreground">
                        {row.p95 === null ? "—" : formatNumber(Number(row.p95))}
                      </td>
                      <td className="p-2">
                        {limit === null ? (
                          "—"
                        ) : over ? (
                          <span className="inline-flex items-center gap-1 text-destructive">
                            <AlertTriangle aria-hidden className="size-4" />
                            تجاوز {formatNumber(limit)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-success">
                            <CheckCircle2 aria-hidden className="size-4" />
                            داخل الحد
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </AdminTableScroll>
        )}
      </AdminCard>

      <AdminCard title="أبطأ الصفحات" description="مرتبة بأبطأ عنصر مرئي (LCP p75).">
        {summary.slow_pages.length === 0 ? (
          <AdminEmptyState icon={Gauge} title="لا صفحة تجاوزت الحد" hint="لا قياسات كافية بعد لهذه النافذة." />
        ) : (
          <AdminTableScroll>
            <table className="w-full text-[14px]">
              <thead className="text-start text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">المسار</th>
                  <th className="p-2 text-start">القياسات</th>
                  <th className="p-2 text-start">LCP p75</th>
                  <th className="p-2 text-start">INP p75</th>
                  <th className="p-2 text-start">CLS p75</th>
                </tr>
              </thead>
              <tbody>
                {summary.slow_pages.map((row) => (
                  <tr key={row.route_path} className="border-t border-border">
                    <td className="p-2 font-medium text-foreground">{row.route_path}</td>
                    <td className="p-2 tabular-nums">{formatNumber(Number(row.samples))}</td>
                    <td className="p-2 tabular-nums">
                      {row.lcp_p75 === null ? "—" : `${formatNumber(Number(row.lcp_p75))}ms`}
                    </td>
                    <td className="p-2 tabular-nums">
                      {row.inp_p75 === null ? "—" : `${formatNumber(Number(row.inp_p75))}ms`}
                    </td>
                    <td className="p-2 tabular-nums">
                      {row.cls_p75 === null ? "—" : Number(row.cls_p75).toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableScroll>
        )}
      </AdminCard>

      <AdminCard
        title="الأصول الثقيلة"
        description={
          budget
            ? `حد الأصل الواحد ${formatNumber(budget.max_asset_kb)}KB — التجاوز يمنع نشر الصفحة عند الضعف.`
            : "حد الأصل من ميزانيات الأداء."
        }
      >
        {summary.heavy_assets.length === 0 ? (
          <AdminEmptyState icon={Gauge} title="لا أصل ثقيل مقيس" hint="لم يتجاوز أي أصل حدّ الإبلاغ." />
        ) : (
          <AdminTableScroll>
            <table className="w-full text-[14px]">
              <thead className="text-start text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">الأصل</th>
                  <th className="p-2 text-start">المسار</th>
                  <th className="p-2 text-start">أكبر حجم</th>
                  <th className="p-2 text-start">مرات الظهور</th>
                </tr>
              </thead>
              <tbody>
                {summary.heavy_assets.map((row) => (
                  <tr key={`${row.asset_path}-${row.route_path}`} className="border-t border-border">
                    <td className="p-2 break-all font-medium text-foreground">{row.asset_path}</td>
                    <td className="p-2 text-muted-foreground">{row.route_path}</td>
                    <td className="p-2 tabular-nums">{formatNumber(Number(row.max_kb))}KB</td>
                    <td className="p-2 tabular-nums">{formatNumber(Number(row.hits))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableScroll>
        )}
      </AdminCard>

      <AdminCard title="ميزانيات الأداء" description="تُستخدم في فحص ما قبل النشر لكل صفحة محتوى.">
        <AdminTableScroll>
          <table className="w-full text-[14px]">
            <thead className="text-start text-muted-foreground">
              <tr>
                <th className="p-2 text-start">نوع الصفحة</th>
                <th className="p-2 text-start">LCP</th>
                <th className="p-2 text-start">INP</th>
                <th className="p-2 text-start">CLS</th>
                <th className="p-2 text-start">أقصى أصل</th>
                <th className="p-2 text-start">أقصى صفحة</th>
              </tr>
            </thead>
            <tbody>
              {summary.budgets.map((row) => (
                <tr key={row.page_type} className="border-t border-border">
                  <td className="p-2 font-medium text-foreground">{row.name_ar}</td>
                  <td className="p-2 tabular-nums">{formatNumber(row.lcp_ms)}ms</td>
                  <td className="p-2 tabular-nums">{formatNumber(row.inp_ms)}ms</td>
                  <td className="p-2 tabular-nums">{(row.cls_milli / 1000).toFixed(3)}</td>
                  <td className="p-2 tabular-nums">{formatNumber(row.max_asset_kb)}KB</td>
                  <td className="p-2 tabular-nums">{formatNumber(row.max_page_kb)}KB</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableScroll>
      </AdminCard>
    </div>
  );
}
