import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import { loadReportForReporter, loadReportReasons, simpleStage } from "@/lib/mkt-reports";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { ReportThread } from "@/components/marketplace/ReportThread";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/my/reports/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تفاصيل البلاغ — گحيل" },
      {
        name: "description",
        content: "تفاصيل البلاغ المقدَّم وحالة المراجعة ومراسلة فريق مراجعة گحيل.",
      },
      { property: "og:title", content: "تفاصيل البلاغ — گحيل" },
      { property: "og:description", content: "حالة البلاغ ونتيجة المراجعة والمراسلات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportDetailPage,
});

function ReportDetailPage() {
  const { id } = Route.useParams();
  const { t, locale } = useI18n();
  const { session } = useSession();

  const report = useQuery({
    queryKey: ["mkt", "report", id, session?.user.id],
    enabled: !!session,
    queryFn: () => loadReportForReporter(id),
  });
  const reasons = useQuery({ queryKey: ["mkt", "report-reasons"], queryFn: loadReportReasons });
  const listing = useQuery({
    queryKey: ["mkt", "report-listing", report.data?.listing_id],
    enabled: !!report.data?.listing_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("mkt_listings")
        .select("id, title, slug, status")
        .eq("id", report.data!.listing_id)
        .maybeSingle();
      return data as { id: string; title: string; slug: string | null; status: string } | null;
    },
  });

  const reason = (reasons.data ?? []).find((r) => r.code === report.data?.reason_code);

  return (
    <DashboardShell title={t("market.reports.detail.title")}>
      <Link
        to="/my/reports"
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <ChevronRight className="size-3 rtl:rotate-180" aria-hidden />
        {t("market.reports.detail.back")}
      </Link>

      {report.isLoading ? (
        <Skeleton className="mt-4 h-40 w-full rounded-xl" />
      ) : !report.data ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("market.reports.detail.notFound")}
        </p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p dir="ltr" className="font-mono text-sm font-bold text-foreground">
                    {report.data.ref_no ?? "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("market.reports.my.submittedAt")}: {formatDateTime(report.data.created_at)}
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                  {t(`market.reports.stage.${simpleStage(report.data.status)}`)}
                </span>
              </div>

              <dl className="mt-4 space-y-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">{t("market.reports.detail.listing")}</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {listing.data?.slug && listing.data.status === "published" ? (
                      <Link
                        to="/ads/$slug"
                        params={{ slug: listing.data.slug }}
                        className="text-primary hover:underline"
                      >
                        {listing.data.title}
                      </Link>
                    ) : (
                      (listing.data?.title ?? t("market.reports.detail.listingRemoved"))
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("market.reports.detail.reason")}</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {reason ? (locale === "ar" ? reason.name_ar : reason.name_en) : "—"}
                  </dd>
                </div>
                {report.data.note && (
                  <div>
                    <dt className="text-muted-foreground">{t("market.reports.detail.note")}</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-foreground">
                      {report.data.note}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <ReportThread reportId={id} side="reporter" />
          </div>

          <aside className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground">
                {t("market.reports.detail.outcome")}
              </h3>
              <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                {report.data.public_outcome ?? t("market.reports.detail.noOutcome")}
              </p>
              {report.data.closed_at && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {t("market.reports.detail.closedAt")}: {formatDateTime(report.data.closed_at)}
                </p>
              )}
            </div>
          </aside>
        </div>
      )}
    </DashboardShell>
  );
}
