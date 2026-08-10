import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { BUSINESS_COLUMNS, MKT_BUCKET, type MktBusiness } from "@/lib/mkt";
import {
  loadVerificationFiles,
  loadVerificationRequests,
  reviewVerification,
  type MktVerificationRequest,
  type VerificationAction,
} from "@/lib/mkt-admin";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/verifications")({
  ssr: "data-only",
  validateSearch: (search: Record<string, unknown>) => ({
    status: typeof search["status"] === "string" ? (search["status"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "توثيق المتاجر — إدارة كَحيل" },
      {
        name: "description",
        content: "مراجعة طلبات توثيق المتاجر ومستنداتها: اعتماد، رفض بسبب، أو طلب استكمال.",
      },
      { property: "og:title", content: "توثيق المتاجر — إدارة كَحيل" },
      { property: "og:description", content: "إدارة طلبات توثيق المتاجر في كَحيل." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminVerificationsPage,
});

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const STATUSES = ["pending", "approved", "rejected", "needs_more"] as const;

function AdminVerificationsPage() {
  const { t, locale } = useI18n();
  const { status: statusParam } = Route.useSearch();
  const [status, setStatus] = useState<string>(statusParam ?? "pending");
  const [decision, setDecision] = useState<{
    request: MktVerificationRequest;
    action: VerificationAction;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const requests = useQuery({
    queryKey: ["mkt", "admin-verifications", status],
    queryFn: () => loadVerificationRequests({ status: status || undefined }),
  });

  const businesses = useQuery({
    queryKey: ["mkt", "admin-businesses"],
    queryFn: async () => {
      const { data } = await supabase.from("mkt_business_profiles").select(BUSINESS_COLUMNS);
      return (data ?? []) as MktBusiness[];
    },
  });

  const files = useQuery({
    queryKey: ["mkt", "admin-verification-files", (requests.data ?? []).map((r) => r.id).join(",")],
    enabled: (requests.data ?? []).length > 0,
    queryFn: () => loadVerificationFiles((requests.data ?? []).map((r) => r.id)),
  });

  const bizName = (tenantId: string) => {
    const biz = businesses.data?.find((b) => b.tenant_id === tenantId);
    if (!biz) return tenantId.slice(0, 8);
    return locale === "ar" ? biz.display_name_ar : biz.display_name_en || biz.display_name_ar;
  };

  async function openDoc(path: string) {
    const { data } = await supabase.storage.from(MKT_BUCKET).createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    else toast.error(t("market.actions.failed"));
  }

  async function submitDecision(reason: string) {
    if (!decision) return;
    if (decision.action !== "approve" && !reason.trim()) {
      toast.error(t("market.admin.reasonRequired"));
      return;
    }
    setBusy(true);
    try {
      await reviewVerification(decision.request.id, decision.action, reason.trim() || undefined);
      toast.success(t("market.admin.decisionSaved"));
      setDecision(null);
      await Promise.all([requests.refetch(), businesses.refetch()]);
    } catch {
      toast.error(t("market.actions.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title={t("market.admin.verifications")}>
      <div className="max-w-xs space-y-1">
        <Label htmlFor="v-status">{t("market.admin.status")}</Label>
        <select
          id="v-status"
          className={selectClass}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{t("market.filters.all")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`market.biz.status.${s}`)}
            </option>
          ))}
        </select>
      </div>

      <ul className="mt-5 space-y-3">
        {requests.isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))
          : (requests.data ?? []).map((req) => {
              const docs = (files.data ?? []).filter((f) => f.request_id === req.id);
              return (
                <li key={req.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        <Link
                          to="/admin/verifications/$id"
                          params={{ id: req.id }}
                          className="underline-offset-2 hover:underline"
                        >
                          {bizName(req.tenant_id)}
                        </Link>
                      </p>
                      <p className="mt-1 text-desc text-muted-foreground" dir="ltr">
                        {new Date(req.created_at).toLocaleString("en-GB", {
                          timeZone: "Asia/Riyadh",
                          hour12: false,
                        })}
                      </p>
                      {req.note && <p className="mt-1 text-desc text-muted-foreground">{req.note}</p>}
                      {req.decision_reason && (
                        <p className="mt-1 text-desc text-destructive">{req.decision_reason}</p>
                      )}
                    </div>
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-desc font-medium text-secondary-foreground">
                      {t(`market.biz.status.${req.status}`)}
                    </span>
                  </div>

                  {docs.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {docs.map((d) => (
                        <li key={d.id}>
                          <button
                            type="button"
                            onClick={() => void openDoc(d.file_path)}
                            className="rounded-full border border-border px-2.5 py-1 text-desc text-foreground hover:bg-accent"
                          >
                            {d.file_name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => setDecision({ request: req, action: "approve" })}
                    >
                      {t("market.admin.approve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDecision({ request: req, action: "reject" })}
                    >
                      {t("market.admin.reject")}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setDecision({ request: req, action: "needs_more" })}
                    >
                      {t("market.admin.needsMore")}
                    </Button>
                  </div>
                </li>
              );
            })}
      </ul>
      {!requests.isLoading && (requests.data ?? []).length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">{t("market.noResults")}</p>
      )}

      <Dialog open={!!decision} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decision
                ? t(
                    `market.admin.${decision.action === "needs_more" ? "needsMore" : decision.action}`,
                  )
                : ""}
            </DialogTitle>
            <DialogDescription>
              {decision ? bizName(decision.request.tenant_id) : ""}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              void submitDecision(String(fd.get("reason") ?? ""));
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="reason">
                {decision?.action === "approve"
                  ? t("market.admin.noteOptional")
                  : t("market.admin.reason")}
              </Label>
              <Textarea
                id="reason"
                name="reason"
                rows={3}
                required={decision?.action !== "approve"}
              />
            </div>
            <Button type="submit" size="sm" disabled={busy}>
              {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              {t("market.admin.confirm")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
