import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FileText, Lock } from "lucide-react";
import { z } from "zod";

import { useI18n } from "@/i18n";
import { formatDateTime } from "@/lib/format";
import { MKT_BUCKET } from "@/lib/mkt";
import { adminErrorMessage, usePlatformIdentity } from "@/lib/mkt-platform";
import { adminCan } from "@/lib/mkt-admin-perms";
import { reviewVerification, type VerificationAction } from "@/lib/mkt-admin";
import { loadAdminVerificationDetail, openSensitiveDocument } from "@/lib/mkt-admin-detail";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { AdminAssignmentBar } from "@/components/marketplace/AdminAssignmentBar";
import { AdminNotes } from "@/components/marketplace/AdminNotes";
import { ReasonDialog } from "@/components/marketplace/ReasonDialog";
import {
  Chip,
  DetailBack,
  DetailError,
  DetailHeader,
  DetailSkeleton,
  EmptyState,
  InfoGrid,
  Panel,
  TabStrip,
  Timeline,
} from "@/components/marketplace/AdminDetail";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({ tab: z.string().optional() });

export const Route = createFileRoute("/admin/verifications_/$id")({
  ssr: "data-only",
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "ملف طلب التوثيق — إدارة منصة كَحيل" },
      {
        name: "description",
        content:
          "مراجعة طلب توثيق متجر: بيانات الطلب ومستنداته وسجل قراراته، مع تسجيل كل فتح لمستند حسّاس.",
      },
      { property: "og:title", content: "ملف طلب التوثيق — إدارة منصة كَحيل" },
      { property: "og:description", content: "مراجعة طلبات توثيق المتاجر في منصة كَحيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminVerificationDetailPage,
});

const ACTION_KEYS: Record<VerificationAction, string> = {
  approve: "market.admin.approve",
  reject: "market.admin.reject",
  needs_more: "market.admin.needsMore",
};

function AdminVerificationDetailPage() {
  const { id } = Route.useParams();
  const { tab = "overview" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { t } = useI18n();
  const { identity } = usePlatformIdentity();
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<VerificationAction | null>(null);
  const [busy, setBusy] = useState(false);

  const canView = adminCan(identity, "verifications.view");
  const canManage = adminCan(identity, "verifications.manage");
  const canNotes = adminCan(identity, "notes.read");

  const detail = useQuery({
    queryKey: ["mkt", "admin", "verification-detail", id],
    enabled: canView,
    queryFn: () => loadAdminVerificationDetail(id),
  });

  const data = detail.data;
  const header = data?.header;

  /** The audit row is written before the signed URL exists, never after. */
  async function openDocument(path: string, kind: string) {
    try {
      const url = await openSensitiveDocument(MKT_BUCKET, path, kind, id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(adminErrorMessage(error, t("market.actions.failed")));
    }
  }

  async function submitDecision(reason: string) {
    if (!decision) return;
    setBusy(true);
    try {
      await reviewVerification(id, decision, reason || undefined);
      toast.success(t("market.admin.decisionSaved"));
      setDecision(null);
      await queryClient.invalidateQueries({
        queryKey: ["mkt", "admin", "verification-detail", id],
      });
    } catch (error) {
      toast.error(adminErrorMessage(error, t("admin.actionFailed")));
    } finally {
      setBusy(false);
    }
  }

  const tabs = [
    { key: "overview", label: t("admin.detail.tab.overview") },
    { key: "documents", label: t("admin.detail.documents"), count: data?.files.length },
    { key: "activity", label: t("admin.detail.tab.activity"), count: data?.events.length },
  ];

  return (
    <AdminShell title={t("admin.detail.verificationFile")} staffAccess={canView}>
      <DetailBack to="/admin/verifications" label={t("admin.detail.backToVerifications")} />

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
          backTo="/admin/verifications"
          backLabel={t("admin.detail.backToVerifications")}
        />
      ) : (
        <div className="mt-2 space-y-4">
          <DetailHeader
            title={header.tenant_name || header.tenant_id.slice(0, 8)}
            subtitle={formatDateTime(header.created_at)}
            chips={
              <Chip
                tone={
                  header.status === "approved"
                    ? "good"
                    : header.status === "rejected"
                      ? "bad"
                      : "warn"
                }
              >
                {t(`admin.verification.${header.status}`)}
              </Chip>
            }
            actions={
              <Button asChild variant="outline" size="sm" className="min-h-11">
                <Link to="/admin/businesses/$id" params={{ id: header.tenant_id }}>
                  {t("admin.detail.openBusinessFile")}
                </Link>
              </Button>
            }
          />

          <AdminAssignmentBar kind="verification" subjectId={id} />

          {canManage && header.status === "pending" && (
            <Panel title={t("admin.detail.reviewActions")}>
              <div className="flex flex-wrap gap-2">
                {(["approve", "needs_more", "reject"] as VerificationAction[]).map((action) => (
                  <Button
                    key={action}
                    size="sm"
                    className="min-h-11"
                    variant={action === "approve" ? "default" : "outline"}
                    onClick={() => setDecision(action)}
                  >
                    {t(ACTION_KEYS[action])}
                  </Button>
                ))}
              </div>
            </Panel>
          )}

          <TabStrip
            tabs={tabs}
            active={tab}
            onChange={(key) => void navigate({ search: { tab: key }, replace: true })}
          />

          {tab === "overview" && (
            <div className="space-y-4">
              <Panel title={t("admin.detail.requestData")}>
                <InfoGrid
                  items={[
                    { label: t("admin.detail.country"), value: header.country },
                    { label: t("admin.detail.submittedBy"), value: header.submitted_by_name },
                    { label: t("admin.users.created"), value: formatDateTime(header.created_at) },
                    {
                      label: t("admin.detail.decidedAt"),
                      value: header.decided_at ? formatDateTime(header.decided_at) : null,
                    },
                    { label: t("admin.detail.decidedBy"), value: header.decided_by_name },
                    {
                      label: t("admin.detail.registration"),
                      value: data.can_view_documents ? header.registration : null,
                    },
                  ]}
                />
                {header.note && (
                  <p className="mt-4 whitespace-pre-wrap text-sm text-foreground">
                    {header.note}
                  </p>
                )}
                {header.decision_reason && (
                  <p className="mt-2 text-desc text-muted-foreground">
                    {t("admin.detail.decisionReason")}: {header.decision_reason}
                  </p>
                )}
              </Panel>
              <AdminNotes
                subjectType="verification"
                subjectId={id}
                canRead={canNotes}
                canWrite={adminCan(identity, "notes.write")}
              />
            </div>
          )}

          {tab === "documents" && (
            <Panel title={t("admin.detail.documents")}>
              {!data.can_view_documents ? (
                <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Lock className="size-4 shrink-0" aria-hidden />
                  {t("admin.detail.documentsDenied")}
                </p>
              ) : data.files.length === 0 ? (
                <EmptyState label={t("common.noData")} />
              ) : (
                <>
                  <p className="text-desc text-muted-foreground">
                    {t("admin.detail.docAccessLogged")}
                  </p>
                  <ul className="mt-3 grid gap-2">
                    {data.files.map((file) => (
                      <li
                        key={file.id}
                        className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {file.file_name || file.doc_kind || file.id.slice(0, 8)}
                          </p>
                          <p className="truncate text-desc tabular-nums text-muted-foreground">
                            {[file.doc_kind, file.mime_type, formatDateTime(file.created_at)]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-11 shrink-0"
                          onClick={() =>
                            void openDocument(file.file_path, file.doc_kind ?? "verification")
                          }
                        >
                          <FileText className="size-4" aria-hidden />
                          {t("admin.detail.openDocument")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>
          )}

          {tab === "activity" && (
            <Panel title={t("admin.detail.decisionHistory")}>
              <Timeline
                items={data.events.map((row) => ({
                  id: row.id,
                  title: `${row.from_status ? `${t(`admin.verification.${row.from_status}`)} → ` : ""}${t(`admin.verification.${row.to_status}`)}`,
                  actor: row.actor_name,
                  at: row.created_at,
                  detail: row.reason,
                }))}
              />
            </Panel>
          )}
        </div>
      )}

      <ReasonDialog
        open={!!decision}
        title={decision ? t(ACTION_KEYS[decision]) : ""}
        description={t("admin.detail.actionDescription")}
        confirmLabel={t("common.confirm")}
        destructive={decision === "reject"}
        pending={busy}
        onCancel={() => setDecision(null)}
        onConfirm={(reason) => void submitDecision(reason)}
      />
    </AdminShell>
  );
}
