import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ClipboardList } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { PageHeader } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { PaymentNoBadge } from "@/components/PaymentNoBadge";
import { ProjectMembersCard } from "@/components/ProjectMembersCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RequestRow } from "@/components/RequestRow";
import { buildRequestTitle, simpleStage } from "@/lib/request-ui";
import { formatDate, pickName } from "@/lib/format";
import { PropertyFile } from "@/components/property/PropertyFile";
import { PROJECT_KIND_LABELS, PROJECT_KINDS, pick, type ProjectKind } from "@/lib/property";
import { useSession } from "@/lib/session";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const qc = useQueryClient();
  const { isAccountant } = useSession();

  const { data: project, isLoading: loadingProject } = useQuery({
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

  const isOpen = (s: string) => s !== "completed" && s !== "cancelled" && s !== "rejected";
  const openCount = requests.filter((r) => isOpen(r.status)).length;
  const actionCount = requests.filter((r) => simpleStage(r.status) === "action_needed").length;
  const awaitingCount = requests.filter((r) => r.status === "awaiting_payment").length;
  const completedCount = requests.filter((r) => r.status === "completed").length;
  const latestOpen = requests.filter((r) => isOpen(r.status)).slice(0, 3);
  const latestPaymentNo =
    requests.find((r) => r.status === "awaiting_payment" && r.payment_no)?.payment_no ?? null;

  const supervisor = project?.supervisors as { name_ar?: string; name_en?: string } | null;
  const na = locale === "ar" ? "غير مضاف" : "Not added";

  /** compact label/value row: value wraps, never widens the page */
  function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div className="flex min-w-0 items-start justify-between gap-3 py-1.5">
        <dt className="shrink-0 text-muted-foreground">{label}</dt>
        <dd className="wrap-anywhere flex-1 text-end font-medium">
          {loadingProject ? <span className="inline-block h-3.5 w-20 animate-pulse rounded bg-muted align-middle" /> : children}
        </dd>
      </div>
    );
  }

  const value = (v: unknown) => (v === null || v === undefined || v === "" ? <span className="font-normal text-muted-foreground">{na}</span> : (v as React.ReactNode));

  return (
    <div className="page-safe">
      <PageHeader
        title={project ? pickName(locale, project.name_ar, project.name_en) : t("projects.title")}
        description={project?.code ?? ""}
        back={
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs">
            <Link to="/projects">
              <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
              {t("common.back")}
            </Link>
          </Button>
        }
      />

      <div className="grid min-w-0 gap-2.5 sm:gap-4 lg:grid-cols-3">
        <Card className="h-auto min-w-0">
          <CardHeader className="p-3 pb-2 sm:p-4 sm:pb-2">
            <CardTitle className="text-[17px] sm:text-lg">{t("common.details")}</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
            <dl className="min-w-0 divide-y divide-border text-[13px] sm:text-sm">
              <Row label={t("projects.code")}>
                <span className="num">{value(project?.code)}</span>
              </Row>
              <Row label={t("projects.supervisor")}>
                {project?.supervisor_id ? (
                  <Link
                    to="/supervisors/$id"
                    params={{ id: project.supervisor_id }}
                    className="text-primary hover:underline"
                  >
                    {pickName(locale, supervisor?.name_ar, supervisor?.name_en)}
                  </Link>
                ) : (
                  value(null)
                )}
              </Row>
              <Row label={t("projects.city")}>{value(project?.city)}</Row>
              <Row label={t("projects.startDate")}>
                <span className="num">{value(project?.start_date ? formatDate(project.start_date) : null)}</span>
              </Row>
              <Row label={locale === "ar" ? "نوع المشروع" : "Project type"}>
                {isAccountant ? (
                  <Select
                    value={(project?.project_type as ProjectKind) ?? "general"}
                    onValueChange={async (v) => {
                      await supabase
                        .from("projects")
                        .update({ project_type: v as ProjectKind })
                        .eq("id", id);
                      await qc.invalidateQueries({ queryKey: ["project", id] });
                    }}
                  >
                    <SelectTrigger className="h-8 w-full max-w-[10rem] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_KINDS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {pick(locale, PROJECT_KIND_LABELS[k])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  pick(locale, PROJECT_KIND_LABELS[(project?.project_type as ProjectKind) ?? "general"])
                )}
              </Row>
              <Row label={t("common.status")}>
                {project ? <StatusBadge status={project.status} /> : value(null)}
              </Row>
            </dl>
          </CardContent>
        </Card>

        <Card className="h-auto min-w-0 lg:col-span-2">

          <CardHeader className="p-3 pb-2 sm:p-4 sm:pb-2">
            <CardTitle className="flex items-center gap-2 text-[17px] sm:text-lg">
              <ClipboardList className="size-4" aria-hidden />
              {t("requests.projectRequests")}
            </CardTitle>
            <div className="no-scrollbar -mx-0.5 mt-2 flex max-w-full flex-wrap gap-1.5 overflow-x-auto px-0.5 text-[11px] font-medium">
              <span className="whitespace-nowrap rounded-full bg-secondary px-2 py-0.5">
                {t("requests.openRequests")}: <span className="num">{openCount}</span>
              </span>
              <span className="whitespace-nowrap rounded-full bg-warning/15 px-2 py-0.5 text-warning-foreground">
                {t("requests.actionRequiredPlural")}: <span className="num">{actionCount}</span>
              </span>
              <span className="whitespace-nowrap rounded-full bg-secondary px-2 py-0.5">
                {t("requests.awaitingPayment")}: <span className="num">{awaitingCount}</span>
              </span>
              <span className="whitespace-nowrap rounded-full bg-secondary px-2 py-0.5">
                {t("requests.completedCount")}: <span className="num">{completedCount}</span>
              </span>
              {latestPaymentNo && <PaymentNoBadge paymentNo={latestPaymentNo} />}
            </div>
          </CardHeader>
          <CardContent className="min-w-0 p-0">
            {requests.length === 0 ? (
              <p className="px-3 pb-3 text-[13px] text-muted-foreground sm:px-4 sm:pb-4">
                {t("requests.noneForProject")}
              </p>
            ) : (
              <>
                <ul className="min-w-0 divide-y divide-border">
                  {latestOpen.map((r) => (
                    <li key={r.id} className="min-w-0">
                      <RequestRow
                        id={r.id}
                        title={buildRequestTitle(
                          {
                            ...r,
                            projectName: project
                              ? pickName(locale, project.name_ar, project.name_en)
                              : null,
                          },
                          t("requests.untitled"),
                          locale,
                        )}
                        requestNo={r.request_no}
                        status={r.status}
                        date={r.request_date}
                      />
                    </li>
                  ))}
                </ul>
                <div className="p-2.5 sm:p-3">
                  <Button asChild variant="outline" size="sm" className="h-9 w-full text-[13px] sm:w-auto">
                    <Link to="/projects/$id/requests" params={{ id }}>
                      {t("requests.viewAllProjectRequests")}
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="min-w-0 lg:col-span-3">
          <ProjectMembersCard projectId={id} />
        </div>

        {project?.project_type === "real_estate" && (
          <div className="min-w-0 lg:col-span-3">
            <PropertyFile projectId={id} />
          </div>
        )}
      </div>
    </div>
  );
}

