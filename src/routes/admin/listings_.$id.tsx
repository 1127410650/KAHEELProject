import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { z } from "zod";

import { useI18n } from "@/i18n";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { resolveMedia } from "@/lib/mkt";
import { adminErrorMessage, usePlatformIdentity } from "@/lib/mkt-platform";
import { adminCan } from "@/lib/mkt-admin-perms";
import { reviewListing, type ListingReviewAction } from "@/lib/mkt-admin";
import { loadAdminListingDetail } from "@/lib/mkt-admin-detail";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { AdminAssignmentBar } from "@/components/marketplace/AdminAssignmentBar";
import { AdminSafetyCard } from "@/components/marketplace/AdminSafetyCard";
import { ModerationCard } from "@/components/marketplace/ModerationCard";
import { AdminNotes } from "@/components/marketplace/AdminNotes";
import { ReasonDialog } from "@/components/marketplace/ReasonDialog";
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

export const Route = createFileRoute("/admin/listings_/$id")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "ملف الإعلان — إدارة منصة گحيل" },
      {
        name: "description",
        content:
          "ملف إداري للإعلان: بياناته وصوره ومؤشراته وبلاغاته وسجل حالاته الكامل، مع قرارات المراجعة داخل لوحة الإدارة.",
      },
      { property: "og:title", content: "ملف الإعلان — إدارة منصة گحيل" },
      { property: "og:description", content: "ملف إداري تفصيلي للإعلان في منصة گحيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminListingDetailPage,
});

const REVIEW_KEYS: Record<ListingReviewAction, string> = {
  approve: "market.admin.approve",
  reject: "market.admin.reject",
  suspend: "market.admin.suspend",
  return: "market.admin.returnToOwner",
};

function AdminListingDetailPage() {
  const { id } = Route.useParams();
  const { tab = "overview" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { t, locale } = useI18n();
  const { identity } = usePlatformIdentity();
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<ListingReviewAction | null>(null);
  const [busy, setBusy] = useState(false);

  const canView = adminCan(identity, "listings.view");
  const canReview = adminCan(identity, "listings.review");
  const canNotes = adminCan(identity, "notes.read");

  const detail = useQuery({
    queryKey: ["mkt", "admin", "listing-detail", id],
    enabled: canView,
    queryFn: () => loadAdminListingDetail(id),
  });

  const data = detail.data;
  const header = data?.header;

  const images = useQuery({
    queryKey: ["mkt", "admin", "listing-detail-media", id, data?.images.length ?? 0],
    enabled: (data?.images.length ?? 0) > 0,
    queryFn: async () => {
      const paths = (data?.images ?? []).map((row) => row.url).filter((u): u is string => !!u);
      const media = await resolveMedia(paths);
      return paths.map((path) => media[path]).filter((url): url is string => !!url);
    },
  });

  async function submitDecision(reason: string) {
    if (!decision) return;
    setBusy(true);
    try {
      await reviewListing(id, decision, reason || undefined);
      toast.success(t("market.admin.decisionSaved"));
      setDecision(null);
      await queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "listing-detail", id] });
    } catch (error) {
      toast.error(adminErrorMessage(error, t("admin.actionFailed")));
    } finally {
      setBusy(false);
    }
  }

  const tabs = [
    { key: "overview", label: t("admin.detail.tab.overview") },
    { key: "media", label: t("admin.detail.tab.media"), count: data?.images.length },
    { key: "reports", label: t("admin.detail.tab.reports"), count: data?.reports.length },
    { key: "activity", label: t("admin.detail.tab.activity"), count: data?.events.length },
  ];

  return (
    <AdminShell title={t("admin.detail.listingFile")} staffAccess={canView}>
      <DetailBack to="/admin/listings" label={t("admin.detail.backToListings")} />

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
          backTo="/admin/listings"
          backLabel={t("admin.detail.backToListings")}
        />
      ) : (
        <div className="mt-2 space-y-4">
          <DetailHeader
            title={header.title || t("admin.detail.untitled")}
            subtitle={header.ref_no ? `#${header.ref_no}` : null}
            chips={
              <>
                <Chip tone={header.status === "published" ? "good" : "neutral"}>
                  {t(`market.dash.status.${header.status}`)}
                </Chip>
                {header.reports_count > 0 && (
                  <Chip tone="bad">{`${t("admin.detail.reports")}: ${header.reports_count}`}</Chip>
                )}
                {header.deleted_at && <Chip tone="bad">{t("admin.detail.deleted")}</Chip>}
              </>
            }
            actions={
              header.slug && header.status === "published" ? (
                <Button asChild variant="outline" size="sm" className="min-h-11">
                  <a href={`/ads/${header.slug}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" aria-hidden />
                    {t("admin.detail.openPublicListing")}
                  </a>
                </Button>
              ) : undefined
            }
          />

          <AdminAssignmentBar kind="listing_review" subjectId={id} />
          {header.owner_user_id && (
            <AdminSafetyCard userId={header.owner_user_id} tenantId={header.tenant_id} />
          )}

          <ModerationCard listingId={id} />

          <StatGrid
            items={[
              { label: t("admin.detail.views"), value: header.views_count },
              { label: t("admin.detail.favorites"), value: header.favorites_count },
              { label: t("admin.detail.shares"), value: header.shares_count },
              { label: t("admin.detail.contacts"), value: header.contact_requests_count },
              { label: t("admin.detail.quotes"), value: header.quote_requests_count },
              { label: t("admin.detail.reports"), value: header.reports_count },
            ]}
          />

          {canReview && (
            <Panel title={t("admin.detail.reviewActions")}>
              <div className="flex flex-wrap gap-2">
                {(["approve", "return", "reject", "suspend"] as ListingReviewAction[]).map(
                  (action) => (
                    <Button
                      key={action}
                      size="sm"
                      className="min-h-11"
                      variant={action === "approve" ? "default" : "outline"}
                      onClick={() => setDecision(action)}
                    >
                      {t(REVIEW_KEYS[action])}
                    </Button>
                  ),
                )}
              </div>
              {header.rejection_reason && (
                <p className="mt-3 break-words text-xs text-muted-foreground">
                  {t("admin.detail.lastRejection")}: {header.rejection_reason}
                </p>
              )}
            </Panel>
          )}

          <TabStrip
            tabs={tabs}
            active={tab}
            onChange={(key) => void navigate({ search: { tab: key }, replace: true })}
          />

          {tab === "overview" && (
            <div className="space-y-4">
              <Panel title={t("admin.detail.listingData")}>
                <InfoGrid
                  items={[
                    {
                      label: t("admin.detail.advertiser"),
                      value: header.tenant_id ? (
                        <Link
                          to="/admin/businesses/$id"
                          params={{ id: header.tenant_id }}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          {header.tenant_name || header.tenant_id.slice(0, 8)}
                        </Link>
                      ) : header.owner_user_id ? (
                        <Link
                          to="/admin/users/$id"
                          params={{ id: header.owner_user_id }}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          {header.owner_name || header.owner_user_id.slice(0, 8)}
                        </Link>
                      ) : null,
                    },
                    { label: t("admin.detail.category"), value: header.category },
                    { label: t("admin.detail.subcategory"), value: header.subcategory },
                    { label: t("admin.detail.city"), value: header.city },
                    { label: t("admin.detail.region"), value: header.region },
                    {
                      label: t("admin.detail.price"),
                      value: header.price != null ? formatMoney(header.price, locale) : null,
                    },
                    { label: t("admin.users.created"), value: formatDateTime(header.created_at) },
                    {
                      label: t("admin.detail.publishedAt"),
                      value: header.published_at ? formatDateTime(header.published_at) : null,
                    },
                    {
                      label: t("admin.detail.expiresAt"),
                      value: header.expires_at ? formatDateTime(header.expires_at) : null,
                    },
                  ]}
                />
                {header.description && (
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm text-foreground">
                    {header.description}
                  </p>
                )}
              </Panel>
              <AdminNotes
                subjectType="listing"
                subjectId={id}
                canRead={canNotes}
                canWrite={adminCan(identity, "notes.write")}
              />
            </div>
          )}

          {tab === "media" && (
            <Panel title={t("admin.detail.tab.media")}>
              {(images.data ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t("common.noData")}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {(images.data ?? []).map((url, index) => (
                    <img
                      key={url}
                      src={url}
                      alt={`${header.title ?? ""} ${index + 1}`}
                      loading="lazy"
                      className="aspect-[4/3] w-full rounded-lg border border-border object-cover"
                    />
                  ))}
                </div>
              )}
            </Panel>
          )}

          {tab === "reports" && (
            <Panel title={t("admin.detail.tab.reports")}>
              <RowList
                rows={data.reports.map((row) => ({
                  id: row.id,
                  to: `/admin/listing-reports?report=${row.id}`,
                  title: row.ref_no ? `#${row.ref_no}` : row.id.slice(0, 8),
                  meta: [
                    row.status,
                    row.reason_code ?? "",
                    row.severity ?? "",
                    formatDate(row.created_at),
                  ],
                }))}
              />
            </Panel>
          )}

          {tab === "activity" && (
            <Panel title={t("admin.detail.statusHistory")}>
              <Timeline
                items={data.events.map((row) => ({
                  id: row.id,
                  title: t(`market.admin.log.type.${row.event_type}`),
                  actor: row.actor_name,
                  at: row.created_at,
                  detail:
                    typeof row.meta?.["reason"] === "string"
                      ? (row.meta["reason"] as string)
                      : null,
                }))}
              />
            </Panel>
          )}
        </div>
      )}

      <ReasonDialog
        open={!!decision}
        title={decision ? t(REVIEW_KEYS[decision]) : ""}
        description={t("admin.detail.actionDescription")}
        confirmLabel={t("common.confirm")}
        destructive={decision === "reject" || decision === "suspend"}
        pending={busy}
        onCancel={() => setDecision(null)}
        onConfirm={(reason) => void submitDecision(reason)}
      />
    </AdminShell>
  );
}
