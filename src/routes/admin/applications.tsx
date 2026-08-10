import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BadgeCheck, FileText, Loader2, SearchCheck, UserRoundCheck, X } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/marketplace/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { adminCan } from "@/lib/mkt-admin-perms";
import { MKT_BUCKET } from "@/lib/mkt";
import {
  joinErrorMessage,
  loadAdminJoinDocuments,
  reviewJoinApplication,
  useAdminJoinApplications,
  type AdminJoinApplication,
} from "@/lib/mkt-provider-onboarding";
import { usePlatformIdentity } from "@/lib/mkt-platform";

export const Route = createFileRoute("/admin/applications")({
  ssr: "data-only",
  head: () => ({
    meta: [{ title: "طلبات الانضمام — إدارة كَحيل" }, { name: "robots", content: "noindex" }],
  }),
  component: JoinApplicationsAdminPage,
});

function JoinApplicationsAdminPage() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const { identity, loading } = usePlatformIdentity();
  const canView = adminCan(identity, "verifications.view");
  const canManage = adminCan(identity, "verifications.manage");
  const [status, setStatus] = useState("pending");
  const [kind, setKind] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminJoinApplication | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const applications = useAdminJoinApplications(
    status === "all" ? null : status,
    kind === "all" ? null : kind,
    canView,
  );

  const documents = useQuery({
    queryKey: ["mkt", "admin", "join-documents", selected?.id ?? null],
    enabled: canView && !!selected,
    queryFn: async () => {
      const rows = await loadAdminJoinDocuments(selected!.id);
      return Promise.all(
        rows.map(async (row) => {
          const { data } = await supabase.storage
            .from(MKT_BUCKET)
            .createSignedUrl(row.storage_path, 300);
          return { ...row, signedUrl: data?.signedUrl ?? null };
        }),
      );
    },
  });

  const term = search.trim().toLowerCase();
  const rows = (applications.data ?? []).filter((row) =>
    !term
      ? true
      : [row.application_number, row.applicant_name, row.tenant_name, row.provider_category_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term)),
  );

  async function review(action: "review" | "approve" | "needs_more" | "reject") {
    if (!selected || busy) return;
    if ((action === "needs_more" || action === "reject") && !reason.trim()) {
      toast.error(locale === "ar" ? "اكتب سبب القرار أولًا." : "Enter a decision reason first.");
      return;
    }
    setBusy(action);
    try {
      await reviewJoinApplication({ applicationId: selected.id, action, reason });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "join-applications"] }),
        queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "overview"] }),
      ]);
      toast.success(
        locale === "ar"
          ? "تم حفظ القرار وإشعار مقدم الطلب."
          : "Decision saved and applicant notified.",
      );
      setSelected(null);
      setReason("");
    } catch (error) {
      toast.error(joinErrorMessage(error, locale));
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminShell
      title={locale === "ar" ? "طلبات الانضمام" : "Join applications"}
      staffAccess={canView}
      staffChecking={loading}
    >
      <div className="space-y-4">
        <div className="grid gap-2 rounded-2xl border bg-card p-3 sm:grid-cols-[1fr_11rem_12rem]">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={
              locale === "ar" ? "بحث بالرقم أو الاسم أو المتجر" : "Search number, name or store"
            }
          />
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            className="h-11 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">{locale === "ar" ? "كل الأنواع" : "All types"}</option>
            <option value="seller">{locale === "ar" ? "بائع" : "Seller"}</option>
            <option value="service_provider">
              {locale === "ar" ? "مقدم خدمة" : "Service provider"}
            </option>
            <option value="delivery_team">
              {locale === "ar" ? "فريق التوصيل" : "Delivery team"}
            </option>
            <option value="platform_team">
              {locale === "ar" ? "فريق العمل" : "Platform team"}
            </option>
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-11 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">{locale === "ar" ? "كل الحالات" : "All statuses"}</option>
            <option value="pending">{locale === "ar" ? "بانتظار المراجعة" : "Pending"}</option>
            <option value="in_review">{locale === "ar" ? "قيد المراجعة" : "In review"}</option>
            <option value="needs_more">{locale === "ar" ? "يتطلب استكمالًا" : "Needs more"}</option>
            <option value="approved">{locale === "ar" ? "مقبول" : "Approved"}</option>
            <option value="rejected">{locale === "ar" ? "مرفوض" : "Rejected"}</option>
          </select>
        </div>

        {applications.isLoading ? (
          <Skeleton className="h-72 rounded-3xl" />
        ) : rows.length === 0 ? (
          <Card className="rounded-3xl border-dashed">
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              {locale === "ar" ? "لا توجد طلبات مطابقة." : "No matching applications."}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  setSelected(row);
                  setReason(row.decision_reason ?? "");
                }}
                className="rounded-3xl border bg-card p-4 text-start shadow-sm transition hover:border-primary/30 hover:shadow-md sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black">
                      {row.applicant_name || (locale === "ar" ? "مستخدم" : "User")}
                    </p>
                    <p className="mt-1 truncate text-desc text-muted-foreground">
                      {row.tenant_name || kindLabel(row.application_kind, locale)}
                    </p>
                  </div>
                  <Badge variant={row.status === "pending" ? "default" : "secondary"}>
                    {statusLabel(row.status, locale)}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-desc text-muted-foreground">
                  <span>{row.application_number}</span>
                  <span>·</span>
                  <span>{kindLabel(row.application_kind, locale)}</span>
                  <span>·</span>
                  <span>
                    {row.documents_count} {locale === "ar" ? "مرفق" : "files"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected ? (
        <div
          className="fixed inset-0 z-[80] flex items-end bg-black/45 p-0 sm:items-center sm:justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-background p-4 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-desc font-bold text-primary">{selected.application_number}</p>
                <h2 className="text-section mt-1 font-black">{selected.applicant_name}</h2>
                <p className="mt-1 text-desc text-muted-foreground">
                  {kindLabel(selected.application_kind, locale)}
                  {selected.tenant_name ? ` · ${selected.tenant_name}` : ""}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setSelected(null)}
                aria-label={locale === "ar" ? "إغلاق" : "Close"}
              >
                <X className="size-5" />
              </Button>
            </div>

            <div className="mt-5 grid gap-2 rounded-2xl bg-secondary/45 p-4 text-sm sm:grid-cols-2">
              {payloadRows(selected, locale).map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <p className="text-desc text-muted-foreground">{label}</p>
                  <p className="mt-1 break-words font-semibold">{value || "—"}</p>
                </div>
              ))}
            </div>

            <section className="mt-5">
              <h3 className="text-sm font-black">
                {locale === "ar" ? "المرفقات الخاصة" : "Private documents"}
              </h3>
              {documents.isLoading ? (
                <Skeleton className="mt-2 h-16" />
              ) : (documents.data ?? []).length ? (
                <div className="mt-2 space-y-2">
                  {(documents.data ?? []).map((document) =>
                    document.signedUrl ? (
                      <a
                        key={document.id}
                        href={document.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm hover:bg-secondary"
                      >
                        <FileText className="size-4 text-primary" />
                        <span className="min-w-0 flex-1 truncate">{document.file_name}</span>
                      </a>
                    ) : null,
                  )}
                </div>
              ) : (
                <p className="mt-2 text-desc text-muted-foreground">
                  {locale === "ar" ? "لا توجد مرفقات إضافية." : "No additional documents."}
                </p>
              )}
            </section>

            {canManage && !["approved", "rejected", "withdrawn"].includes(selected.status) ? (
              <section className="mt-5 space-y-3 border-t pt-5">
                <div className="space-y-2">
                  <Label htmlFor="join-decision-reason">
                    {locale === "ar"
                      ? "سبب القرار أو طلب الاستكمال"
                      : "Decision or information-request reason"}
                  </Label>
                  <Textarea
                    id="join-decision-reason"
                    value={reason}
                    maxLength={1000}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Button variant="outline" disabled={!!busy} onClick={() => void review("review")}>
                    <SearchCheck className="me-1 size-4" />
                    {locale === "ar" ? "بدء المراجعة" : "Review"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!!busy}
                    onClick={() => void review("needs_more")}
                  >
                    <FileText className="me-1 size-4" />
                    {locale === "ar" ? "طلب استكمال" : "Need more"}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={!!busy}
                    onClick={() => void review("reject")}
                  >
                    <X className="me-1 size-4" />
                    {locale === "ar" ? "رفض" : "Reject"}
                  </Button>
                  <Button disabled={!!busy} onClick={() => void review("approve")}>
                    {busy === "approve" ? (
                      <Loader2 className="me-1 size-4 animate-spin" />
                    ) : (
                      <UserRoundCheck className="me-1 size-4" />
                    )}
                    {locale === "ar" ? "قبول وتفعيل" : "Approve"}
                  </Button>
                </div>
              </section>
            ) : (
              <p className="mt-5 rounded-2xl border p-4 text-sm">
                <BadgeCheck className="me-1 inline size-4 text-primary" />
                {locale === "ar"
                  ? `الحالة النهائية: ${statusLabel(selected.status, locale)}`
                  : `Final status: ${statusLabel(selected.status, locale)}`}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}

function kindLabel(kind: string, locale: "ar" | "en") {
  const labels: Record<string, [string, string]> = {
    seller: ["بائع", "Seller"],
    service_provider: ["مقدم خدمة", "Service provider"],
    delivery_team: ["فريق التوصيل", "Delivery team"],
    platform_team: ["فريق العمل", "Platform team"],
  };
  return labels[kind]?.[locale === "ar" ? 0 : 1] ?? kind;
}

function statusLabel(status: string, locale: "ar" | "en") {
  const labels: Record<string, [string, string]> = {
    pending: ["بانتظار المراجعة", "Pending"],
    in_review: ["قيد المراجعة", "In review"],
    needs_more: ["يتطلب استكمالًا", "Needs more"],
    approved: ["مقبول", "Approved"],
    rejected: ["مرفوض", "Rejected"],
    withdrawn: ["مسحوب", "Withdrawn"],
  };
  return labels[status]?.[locale === "ar" ? 0 : 1] ?? status;
}

function payloadRows(
  application: AdminJoinApplication,
  locale: "ar" | "en",
): Array<[string, string]> {
  const payload = application.payload;
  const value = (key: string) => (typeof payload[key] === "string" ? String(payload[key]) : "");
  return [
    [locale === "ar" ? "الاسم" : "Name", value("full_name")],
    [locale === "ar" ? "الجوال" : "Mobile", value("phone")],
    [locale === "ar" ? "البريد" : "Email", value("email")],
    [locale === "ar" ? "المدينة" : "City", value("city")],
    [
      locale === "ar" ? "النشاط" : "Activity",
      application.provider_category_name || value("activity"),
    ],
    [locale === "ar" ? "الخبرة" : "Experience", value("experience") || value("note")],
  ];
}
