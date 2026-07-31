import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { PageHeader } from "@/components/AppLayout";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({
    meta: [
      { title: "سجل العمليات — تحقّق | Audit log — Tahqaq" },
      { name: "description", content: "سجل غير قابل للتعديل لكل العمليات على بيانات نظام تحقّق." },
      { property: "og:title", content: "سجل العمليات — تحقّق" },
      { property: "og:description", content: "Immutable audit trail of all system operations." },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const { t } = useI18n();

  const { data: rows = [] } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => {
      const [{ data, error }, { data: profiles }] = await Promise.all([
        supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("profiles").select("user_id, full_name"),
      ]);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        actorName:
          (profiles ?? []).find((p) => p.user_id === row.actor_id)?.full_name ?? "—",
      }));
    },
  });

  return (
    <>
      <PageHeader title={t("audit.title")} description={t("audit.description")} />

      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 text-start font-semibold">{t("common.date")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("audit.actor")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("audit.entity")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("audit.action")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("common.reason")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    {t("audit.empty")}
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-secondary/40">
                  <td className="num px-4 py-3 whitespace-nowrap">
                    {formatDateTime(row.created_at)}
                  </td>
                  <td className="px-4 py-3">{row.actorName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.entity_type}</td>
                  <td className="px-4 py-3">{t(`audit.actions.${row.action}`)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
