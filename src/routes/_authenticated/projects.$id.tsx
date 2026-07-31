import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardList } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { PageHeader } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { PaymentNoBadge } from "@/components/PaymentNoBadge";
import { ProjectMembersCard } from "@/components/ProjectMembersCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StageBadge } from "@/components/RequestStage";
import { buildRequestTitle } from "@/lib/request-ui";
import { formatDate, pickName } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  head: () => ({
    meta: [
      { title: "ملف المشروع — تحقّق | Project — Tahqaq" },
      { name: "description", content: "ملف المشروع: بياناته، مشرفه، وطلباته وحالات سدادها." },
      { property: "og:title", content: "ملف المشروع — تحقّق" },
      { property: "og:description", content: "Project profile, supervisor and linked requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { id } = Route.useParams();
  const { t, locale } = useI18n();
  const navigate = useNavigate();

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, supervisors(id, name_ar, name_en)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["project-requests", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("*, supervisors(name_ar, name_en)")
        .eq("project_id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const openCount = requests.filter(
    (r) => r.status !== "completed" && r.status !== "cancelled",
  ).length;
  const awaitingCount = requests.filter((r) => r.status === "awaiting_payment").length;
  const latestPaymentNo =
    requests.find((r) => r.status === "awaiting_payment" && r.payment_no)?.payment_no ?? null;

  const supervisor = project?.supervisors as { name_ar?: string; name_en?: string } | null;

  return (
    <>
      <PageHeader
        title={project ? pickName(locale, project.name_ar, project.name_en) : t("projects.title")}
        description={project?.code ?? ""}
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link to="/projects">
              <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
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
                <dt className="text-muted-foreground">{t("projects.code")}</dt>
                <dd className="num font-medium">{project?.code ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground">{t("projects.supervisor")}</dt>
                <dd className="font-medium">
                  {project?.supervisor_id ? (
                    <Link
                      to="/supervisors/$id"
                      params={{ id: project.supervisor_id }}
                      className="text-primary hover:underline"
                    >
                      {pickName(locale, supervisor?.name_ar, supervisor?.name_en)}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground">{t("projects.city")}</dt>
                <dd className="font-medium">{project?.city ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground">{t("projects.startDate")}</dt>
                <dd className="num font-medium">{formatDate(project?.start_date)}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground">{t("common.status")}</dt>
                <dd>{project && <StatusBadge status={project.status} />}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-3 text-base">
              <ClipboardList className="size-4" aria-hidden />
              {t("requests.projectRequests")}
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
                {t("requests.openRequests")}: <span className="num">{openCount}</span>
              </span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
                {t("requests.awaitingPayment")}: <span className="num">{awaitingCount}</span>
              </span>
              {latestPaymentNo && <PaymentNoBadge paymentNo={latestPaymentNo} />}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {requests.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">{t("requests.empty")}</p>
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {requests.slice(0, 5).map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="w-full px-6 py-3 text-start transition hover:bg-secondary/40"
                        onClick={() => void navigate({ to: "/requests/$id", params: { id: r.id } })}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium">
                            {buildRequestTitle(
                              {
                                ...r,
                                projectName: project
                                  ? pickName(locale, project.name_ar, project.name_en)
                                  : null,
                              },
                              t("requests.untitled"),
                            )}
                          </span>
                          <StageBadge status={r.status} />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="num">{r.request_no}</span>
                          <span>
                            {pickName(
                              locale,
                              (r.supervisors as { name_ar?: string } | null)?.name_ar,
                              (r.supervisors as { name_en?: string } | null)?.name_en,
                            )}
                          </span>
                          <span className="num">
                            {t("common.date")}: {formatDate(r.request_date)}
                          </span>
                          <PaymentNoBadge paymentNo={r.payment_no} />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
                {requests.length > 5 && (
                  <div className="px-6 py-3">
                    <Button asChild variant="outline" size="sm">
                      <Link to="/requests">{t("requests.viewAll")}</Link>
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>


        <div className="lg:col-span-3">
          <ProjectMembersCard projectId={id} />
        </div>
      </div>
    </>
  );
}
