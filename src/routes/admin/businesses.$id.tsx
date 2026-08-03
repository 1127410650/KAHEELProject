import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { z } from "zod";

import { useI18n } from "@/i18n";
import { formatDate, formatDateTime } from "@/lib/format";
import { usePlatformIdentity } from "@/lib/mkt-platform";
import { adminCan } from "@/lib/mkt-admin-perms";
import { loadAdminBusinessDetail } from "@/lib/mkt-admin-detail";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { AdminNotes } from "@/components/marketplace/AdminNotes";
import { AdminEnforcement } from "@/components/marketplace/AdminEnforcement";
import {
  Chip,
  DetailBack,
  DetailError,
  DetailHeader,
  DetailSkeleton,
  InfoGrid,
  Panel,
  RowList,
  StatGrid,
  TabStrip,
  Timeline,
} from "@/components/marketplace/AdminDetail";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({ tab: z.string().optional() });

export const Route = createFileRoute("/admin/businesses/$id")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "ملف المنشأة — إدارة منصة تحقّق" },
      {
        name: "description",
        content:
          "ملف إداري للمنشأة: بياناتها وأنشطتها وأعضاؤها وإعلاناتها وطلبات توثيقها وقيودها وسجل الإجراءات عليها.",
      },
      { property: "og:title", content: "ملف المنشأة — إدارة منصة تحقّق" },
      { property: "og:description", content: "ملف إداري تفصيلي للمنشأة في منصة تحقّق." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminBusinessDetailPage,
});

function AdminBusinessDetailPage() {
  const { id } = Route.useParams();
  const { tab = "overview" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { t } = useI18n();
  const { identity } = usePlatformIdentity();

  const canView = adminCan(identity, "businesses.view");
  const canDocs = adminCan(identity, "docs.view_sensitive");
  const canNotes = adminCan(identity, "notes.read");

  const detail = useQuery({
    queryKey: ["mkt", "admin", "business-detail", id],
    enabled: canView,
    queryFn: () => loadAdminBusinessDetail(id),
  });

  const data = detail.data;
  const header = data?.header;
  const name = header?.name?.trim() || id.slice(0, 8);

  const tabs = [
    { key: "overview", label: t("admin.detail.tab.overview") },
    { key: "listings", label: t("admin.detail.tab.listings"), count: data?.counts.listings },
    { key: "members", label: t("admin.detail.tab.members"), count: data?.counts.members },
    {
      key: "verifications",
      label: t("admin.detail.tab.verification"),
      count: data?.verifications.length,
    },
    { key: "reports", label: t("admin.detail.tab.reports"), count: data?.counts.reports },
    { key: "enforcement", label: t("admin.detail.tab.enforcement") },
    { key: "activity", label: t("admin.detail.tab.activity") },
  ];

  return (
    <AdminShell title={t("admin.detail.businessFile")} staffAccess={canView}>
      <DetailBack to="/admin/businesses" label={t("admin.detail.backToBusinesses")} />

      {!canView ? (
        <DetailError
          message={t("market.admin.denied")}
          backTo="/admin"
          backLabel={t("admin.backToAdmin")}
        />
      ) : detail.isLoading ? (
        <DetailSkeleton />
      ) : detail.isError || !header ? (
        <DetailError
          message={t("admin.detail.notFound")}
          backTo="/admin/businesses"
          backLabel={t("admin.detail.backToBusinesses")}
        />
      ) : (
        <div className="mt-2 space-y-4">
          <DetailHeader
            title={name}
            subtitle={header.headline}
            chips={
              <>
                <Chip tone={header.verification_status === "approved" ? "good" : "neutral"}>
                  {header.verification_status
                    ? t(`admin.verification.${header.verification_status}`)
                    : t("admin.detail.notSubmitted")}
                </Chip>
                <Chip tone={header.is_published ? "good" : "warn"}>
                  {header.is_published
                    ? t("admin.detail.published")
                    : t("admin.detail.unpublished")}
                </Chip>
                {data.counts.restrictions_active > 0 && (
                  <Chip tone="bad">{t("admin.detail.restricted")}</Chip>
                )}
              </>
            }
            actions={
              header.slug ? (
                <Button asChild variant="outline" size="sm" className="min-h-11">
                  <a href={`/businesses/${header.slug}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" aria-hidden />
                    {t("admin.business.openPublic")}
                  </a>
                </Button>
              ) : undefined
            }
          />

          <StatGrid
            items={[
              { label: t("admin.detail.tab.listings"), value: data.counts.listings },
              { label: t("admin.detail.tab.members"), value: data.counts.members },
              { label: t("admin.detail.tab.reports"), value: data.counts.reports },
              { label: t("admin.detail.activeRestrictions"), value: data.counts.restrictions_active },
            ]}
          />

          <TabStrip
            tabs={tabs}
            active={tab}
            onChange={(key) => void navigate({ search: { tab: key }, replace: true })}
          />

          {tab === "overview" && (
            <div className="space-y-4">
              <Panel title={t("admin.detail.businessData")}>
                <InfoGrid
                  items={[
                    { label: t("admin.detail.nameAr"), value: header.name },
                    { label: t("admin.detail.nameEn"), value: header.name_en },
                    { label: t("admin.detail.country"), value: header.country },
                    { label: t("admin.detail.region"), value: header.region },
                    { label: t("admin.detail.city"), value: header.city },
                    { label: t("admin.detail.mainActivity"), value: header.main_activity },
                    {
                      label: t("admin.detail.subActivities"),
                      value: header.sub_activities?.join("، "),
                    },
                    { label: t("admin.detail.officer"), value: header.officer },
                    { label: t("admin.users.created"), value: formatDateTime(header.created_at) },
                    {
                      label: t("admin.detail.verifiedAt"),
                      value: header.verified_at ? formatDateTime(header.verified_at) : null,
                    },
                    { label: t("admin.detail.publicPhone"), value: header.public_phone },
                    { label: t("admin.detail.publicEmail"), value: header.public_email },
                  ]}
                />
                {canDocs && (
                  <div className="mt-4 rounded-lg border border-border bg-background p-3">
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      {t("admin.detail.sensitiveData")}
                    </p>
                    <div className="mt-2">
                      <InfoGrid
                        items={[
                          { label: t("admin.detail.registration"), value: header.registration },
                          { label: t("admin.detail.vatNumber"), value: header.vat_number },
                        ]}
                      />
                    </div>
                  </div>
                )}
              </Panel>
              <AdminNotes
                subjectType="business"
                subjectId={id}
                canRead={canNotes}
                canWrite={adminCan(identity, "notes.write")}
              />
            </div>
          )}

          {tab === "listings" && (
            <Panel title={t("admin.detail.tab.listings")}>
              <RowList
                rows={data.listings.map((row) => ({
                  id: row.id,
                  to: `/admin/listings/${row.id}`,
                  title: row.title || t("admin.detail.untitled"),
                  meta: [
                    row.ref_no ? `#${row.ref_no}` : "",
                    t(`market.listingStatus.${row.status}`),
                    row.city ?? "",
                    formatDate(row.created_at),
                  ],
                }))}
              />
            </Panel>
          )}

          {tab === "members" && (
            <Panel title={t("admin.detail.tab.members")}>
              <RowList
                rows={data.members.map((row) => ({
                  id: row.user_id,
                  to: `/admin/users/${row.user_id}`,
                  title: row.name || row.email || row.user_id.slice(0, 8),
                  meta: [row.role, formatDate(row.joined_at)],
                }))}
              />
            </Panel>
          )}

          {tab === "verifications" && (
            <Panel title={t("admin.detail.tab.verification")}>
              <RowList
                rows={data.verifications.map((row) => ({
                  id: row.id,
                  to: `/admin/verifications/${row.id}`,
                  title: t(`admin.verification.${row.status}`),
                  meta: [
                    formatDateTime(row.created_at),
                    row.decided_at ? formatDateTime(row.decided_at) : "",
                    `${t("admin.detail.documents")}: ${row.files ?? 0}`,
                  ],
                }))}
              />
            </Panel>
          )}

          {tab === "reports" && (
            <Panel title={t("admin.detail.tab.reports")}>
              <RowList
                rows={data.reports.map((row) => ({
                  id: row.id,
                  to: `/admin/listing-reports?report=${row.id}`,
                  title: row.ref_no ? `#${row.ref_no}` : row.id.slice(0, 8),
                  meta: [row.status, row.decision ?? "", formatDate(row.created_at)],
                }))}
              />
            </Panel>
          )}

          {tab === "enforcement" && (
            <div className="space-y-4">
              <AdminEnforcement
                subjectType="business"
                subjectId={id}
                subjectName={name}
                restrictions={data.restrictions}
                canManage={adminCan(identity, "restrictions.manage")}
                notifiableUserId={header.officer_id}
                invalidateKey={["mkt", "admin", "business-detail", id]}
              />
              <AdminNotes
                subjectType="business"
                subjectId={id}
                canRead={canNotes}
                canWrite={adminCan(identity, "notes.write")}
              />
            </div>
          )}

          {tab === "activity" && (
            <Panel title={t("admin.detail.auditTrail")}>
              <Timeline
                items={data.audit.map((row) => ({
                  id: row.id,
                  title: `${row.entity_type} · ${row.action}`,
                  actor: row.actor_name,
                  at: row.created_at,
                  detail: row.reason,
                }))}
              />
            </Panel>
          )}
        </div>
      )}
    </AdminShell>
  );
}
