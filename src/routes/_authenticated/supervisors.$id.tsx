import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardList } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { PageHeader } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PaymentNoBadge } from "@/components/PaymentNoBadge";
import { formatDate, formatDateTime, formatMoney, pickName } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/supervisors/$id")({
  head: () => ({
    meta: [
      { title: "ملف المشرف — تحقّق | Supervisor — Tahqaq" },
      { name: "description", content: "ملف المشرف: بياناته، مشاريعه، رصيد عهدته وحركاتها." },
      { property: "og:title", content: "ملف المشرف — تحقّق" },
      { property: "og:description", content: "Supervisor profile, projects and custody ledger." },
    ],
  }),
  component: SupervisorDetailPage,
});

function SupervisorDetailPage() {
  const { id } = Route.useParams();
  const { t, locale } = useI18n();
  const navigate = useNavigate();

  const { data: requests = [] } = useQuery({
    queryKey: ["supervisor-requests", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("*, projects!requests_project_id_fkey(code, name_ar, name_en)")
        .eq("supervisor_id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data } = useQuery({
    queryKey: ["supervisor", id],
    queryFn: async () => {
      const [supervisor, projects, txns, balance] = await Promise.all([
        supabase.from("supervisors").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("projects")
          .select("id, code, name_ar, name_en, status")
          .eq("supervisor_id", id)
          .is("deleted_at", null),
        supabase
          .from("custody_transactions")
          .select("id, serial_no, txn_type, amount, txn_date, status")
          .eq("supervisor_id", id)
          .is("deleted_at", null)
          .order("serial_no", { ascending: false }),
        supabase.from("custody_balances").select("*").eq("supervisor_id", id).maybeSingle(),
      ]);
      return {
        supervisor: supervisor.data,
        projects: projects.data ?? [],
        txns: txns.data ?? [],
        balance: Number(balance.data?.balance ?? 0),
      };
    },
  });

  const supervisor = data?.supervisor;

  return (
    <>
      <PageHeader
        title={
          supervisor ? pickName(locale, supervisor.name_ar, supervisor.name_en) : t("supervisors.profile")
        }
        description={t("supervisors.profile")}
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link to="/supervisors">
              <ArrowRight className="size-4 rtl:rotate-0 ltr:rotate-180" aria-hidden />
              {t("common.back")}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("common.details")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border text-sm">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground">{t("supervisors.nationalId")}</dt>
                <dd className="num font-medium">{supervisor?.national_id ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground">{t("supervisors.phone")}</dt>
                <dd className="num font-medium">{supervisor?.phone ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground">{t("common.status")}</dt>
                <dd>
                  <StatusBadge status={supervisor?.is_active ? "active" : "inactive"} />
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground">{t("supervisors.balance")}</dt>
                <dd className="num font-bold text-primary">
                  {formatMoney(data?.balance ?? 0, locale)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("supervisors.projects")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(data?.projects ?? []).length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">{t("projects.empty")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {(data?.projects ?? []).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-6 py-3">
                    <span className="min-w-0 truncate text-sm">
                      <span className="num text-muted-foreground">{p.code}</span>{" "}
                      {pickName(locale, p.name_ar, p.name_en)}
                    </span>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">{t("custody.statement")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(data?.txns ?? []).length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">{t("custody.empty")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {(data?.txns ?? []).map((txn) => (
                  <li key={txn.id} className="px-6 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm">{t(`custody.types.${txn.txn_type}`)}</span>
                      <span className="num text-sm font-semibold">
                        {formatMoney(txn.amount, locale)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="num text-xs text-muted-foreground">
                        #{txn.serial_no} · {formatDate(txn.txn_date)}
                      </span>
                      <StatusBadge status={txn.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4" aria-hidden />
              {t("requests.supervisorRequests")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {requests.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">{t("requests.empty")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {requests.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="w-full px-6 py-3 text-start transition hover:bg-secondary/40"
                      onClick={() => void navigate({ to: "/requests/$id", params: { id: r.id } })}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          <span className="num">{r.request_no}</span> · {r.request_type}
                        </span>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          <span className="num">
                            {(r.projects as { code?: string } | null)?.code ?? "—"}
                          </span>{" "}
                          {pickName(
                            locale,
                            (r.projects as { name_ar?: string } | null)?.name_ar,
                            (r.projects as { name_en?: string } | null)?.name_en,
                          )}
                        </span>
                        <span className="num">
                          {t("common.date")}: {formatDate(r.request_date)}
                        </span>
                        <PaymentNoBadge paymentNo={r.payment_no} />
                        <span className="num">
                          {t("requests.lastUpdate")}: {formatDateTime(r.updated_at)}
                        </span>
                      </div>
                    </button>
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
