import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { useI18n } from "@/i18n";
import { formatDate, formatDateTime } from "@/lib/format";
import { usePlatformIdentity } from "@/lib/mkt-platform";
import { adminCan } from "@/lib/mkt-admin-perms";
import { loadAdminUserDetail } from "@/lib/mkt-admin-detail";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { AdminAssignmentBar } from "@/components/marketplace/AdminAssignmentBar";
import { AdminSafetyCard } from "@/components/marketplace/AdminSafetyCard";
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

const searchSchema = z.object({ tab: z.string().optional() });

export const Route = createFileRoute("/admin/users_/$id")({
  ssr: "data-only",
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "ملف المستخدم — إدارة منصة گحيل" },
      {
        name: "description",
        content:
          "ملف إداري للمستخدم: بياناته وإعلاناته وعضوياته وبلاغاته وقيوده وسجل الإجراءات عليه، داخل لوحة الإدارة.",
      },
      { property: "og:title", content: "ملف المستخدم — إدارة منصة گحيل" },
      { property: "og:description", content: "ملف إداري تفصيلي للمستخدم في منصة گحيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminUserDetailPage,
});

function AdminUserDetailPage() {
  const { id } = Route.useParams();
  const { tab = "overview" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { t } = useI18n();
  const { identity } = usePlatformIdentity();

  const canView = adminCan(identity, "users.view");
  const canManage = adminCan(identity, "restrictions.manage");
  const canNotes = adminCan(identity, "notes.read");

  const detail = useQuery({
    queryKey: ["mkt", "admin", "user-detail", id],
    enabled: canView,
    queryFn: () => loadAdminUserDetail(id),
  });

  const data = detail.data;
  const header = data?.header;
  const name = header?.full_name?.trim() || t("admin.users.noName");

  const tabs = [
    { key: "overview", label: t("admin.detail.tab.overview") },
    { key: "listings", label: t("admin.detail.tab.listings"), count: data?.counts.listings },
    { key: "businesses", label: t("admin.detail.tab.businesses"), count: data?.counts.businesses },
    { key: "reports", label: t("admin.detail.tab.reports"), count: data?.counts.reports_against },
    { key: "enforcement", label: t("admin.detail.tab.enforcement"), count: data?.counts.restrictions },
    { key: "activity", label: t("admin.detail.tab.activity") },
  ];

  return (
    <AdminShell title={t("admin.detail.userFile")} staffAccess={canView}>
      <DetailBack to="/admin/users" label={t("admin.detail.backToUsers")} />

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
          backTo="/admin/users"
          backLabel={t("admin.detail.backToUsers")}
        />
      ) : (
        <div className="mt-2 space-y-4">
          <DetailHeader
            title={name}
            subtitle={header.email}
            chips={
              <>
                <Chip tone={header.is_active === false ? "bad" : "good"}>
                  {header.is_active === false ? t("admin.detail.inactive") : t("admin.status.active")}
                </Chip>
                {data.counts.restrictions_active > 0 && (
                  <Chip tone="bad">{t("admin.detail.restricted")}</Chip>
                )}
                {header.platform_role && (
                  <Chip tone="warn">
                    {header.platform_role === "system_owner"
                      ? t("admin.role.systemOwner")
                      : t("admin.role.platformAdmin")}
                  </Chip>
                )}
              </>
            }
          />

          <AdminAssignmentBar kind="account_review" subjectId={id} />
          <AdminSafetyCard userId={id} />



          <StatGrid
            items={[
              { label: t("admin.detail.tab.listings"), value: data.counts.listings },
              { label: t("admin.detail.tab.businesses"), value: data.counts.businesses },
              { label: t("admin.detail.reportsAgainst"), value: data.counts.reports_against },
              { label: t("admin.detail.reportsFiled"), value: data.counts.reports_filed },
              { label: t("admin.detail.activeRestrictions"), value: data.counts.restrictions_active },
              { label: t("admin.detail.verifications"), value: data.verifications.length },
            ]}
          />

          <TabStrip
            tabs={tabs}
            active={tab}
            onChange={(key) => void navigate({ search: { tab: key }, replace: true })}
          />

          {tab === "overview" && (
            <div className="space-y-4">
              <Panel title={t("admin.detail.identity")}>
                <InfoGrid
                  items={[
                    { label: t("admin.users.user"), value: name },
                    { label: t("common.email"), value: header.email },
                    { label: t("admin.users.phone"), value: header.phone },
                    { label: t("admin.users.created"), value: formatDateTime(header.created_at) },
                    { label: t("admin.detail.country"), value: header.country },
                    { label: t("admin.detail.locale"), value: header.locale },
                  ]}
                />
                <p className="mt-3 text-[11px] text-muted-foreground">
                  {t("admin.detail.noCredentials")}
                </p>
              </Panel>
              <AdminNotes
                subjectType="user"
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
                    t(`market.dash.status.${row.status}`),
                    row.city ?? "",
                    formatDate(row.created_at),
                  ],
                  trailing:
                    (row.reports_count ?? 0) > 0 ? (
                      <Chip tone="bad">{`${t("admin.detail.reports")}: ${row.reports_count}`}</Chip>
                    ) : undefined,
                }))}
              />
            </Panel>
          )}

          {tab === "businesses" && (
            <Panel title={t("admin.detail.tab.businesses")}>
              <RowList
                rows={data.businesses.map((row) => ({
                  id: row.tenant_id,
                  to: `/admin/businesses/${row.tenant_id}`,
                  title: row.name || row.tenant_id.slice(0, 8),
                  meta: [
                    row.role,
                    row.verification_status ?? "",
                    formatDate(row.joined_at),
                  ],
                }))}
              />
            </Panel>
          )}

          {tab === "reports" && (
            <div className="space-y-4">
              <Panel title={t("admin.detail.reportsAgainst")}>
                <RowList
                  rows={data.reports_against.map((row) => ({
                    id: row.id,
                    to: `/admin/listing-reports?report=${row.id}`,
                    title: row.ref_no ? `#${row.ref_no}` : row.id.slice(0, 8),
                    meta: [row.status, row.decision ?? "", formatDate(row.created_at)],
                  }))}
                />
              </Panel>
              <Panel title={t("admin.detail.reportsFiled")}>
                <RowList
                  rows={data.reports_filed.map((row) => ({
                    id: row.id,
                    title: row.ref_no ? `#${row.ref_no}` : row.id.slice(0, 8),
                    meta: [row.status, row.decision ?? "", formatDate(row.created_at)],
                  }))}
                />
              </Panel>
            </div>
          )}

          {tab === "enforcement" && (
            <div className="space-y-4">
              <AdminEnforcement
                subjectType="user"
                subjectId={id}
                subjectName={name}
                restrictions={data.restrictions}
                canManage={canManage}
                isSelf={identity?.user_id === id}
                isSystemOwnerSubject={header.platform_role === "system_owner"}
                notifiableUserId={id}
                invalidateKey={["mkt", "admin", "user-detail", id]}
              />
              <AdminNotes
                subjectType="user"
                subjectId={id}
                canRead={canNotes}
                canWrite={adminCan(identity, "notes.write")}
              />
            </div>
          )}

          {tab === "activity" && (
            <div className="space-y-4">
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
              <Panel title={t("admin.detail.notificationsSent")}>
                <Timeline
                  items={data.notifications.map((row) => ({
                    id: row.id,
                    title: row.title || row.event,
                    at: row.created_at,
                    detail: row.read_at ? t("admin.detail.read") : t("admin.detail.unread"),
                  }))}
                />
              </Panel>
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}
