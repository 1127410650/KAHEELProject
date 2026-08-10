/**
 * Admin queue for ownership claims. Approval is always manual, never automatic,
 * and every document is opened through a short-lived signed URL — the bucket is
 * private, so a direct file URL is refused.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, ShieldQuestion } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/marketplace/AdminShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import {
  CLAIM_DOC_KIND_LABEL,
  CLAIM_DOC_RETENTION_DAYS,
  claimDocumentUrl,
  useAdminGuideClaims,
  useDecideGuideClaim,
  type ClaimStatus,
} from "@/lib/mkt-guide-legal";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/admin/guide-claims")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "مطالبات ملكية جهات الدليل — لوحة مدير النظام" },
      {
        name: "description",
        content: "مراجعة يدوية لمطالبات ملكية جهات الدليل ومستنداتها في حاوية تخزين خاصة.",
      },
      { property: "og:title", content: "مطالبات ملكية جهات الدليل" },
      { property: "og:description", content: "اعتماد أو رفض المطالبات بعد فحص المستندات." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminGuideClaimsPage,
});

const TABS: { value: ClaimStatus; label: string }[] = [
  { value: "pending", label: "قيد المراجعة" },
  { value: "approved", label: "معتمد" },
  { value: "rejected", label: "مرفوض" },
];

const ROLE_LABEL: Record<string, string> = { owner: "مالك", agent: "مفوّض" };

function AdminGuideClaimsPage() {
  const { session } = useSession();
  const [status, setStatus] = useState<ClaimStatus>("pending");
  const claims = useAdminGuideClaims(true, status);
  const decide = useDecideGuideClaim(session?.user.id ?? null);

  const openDocument = async (path: string) => {
    const url = await claimDocumentUrl(path);
    if (!url) {
      toast.error("تعذّر فتح المستند.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const rows = claims.data ?? [];

  return (
    <AdminShell title="مطالبات ملكية جهات الدليل">
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-black">مطالبات ملكية جهات الدليل</h1>
          <p className="text-[12px] text-muted-foreground">
            لا موافقة بلا إثبات: كل مطالبة تُعتمد يدويًا بعد فحص المستندات، وتُحذف المستندات تلقائيًا
            بعد {CLAIM_DOC_RETENTION_DAYS.toLocaleString("en-US")} يومًا من البتّ.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TABS.map((tab) => (
            <Button
              key={tab.value}
              size="sm"
              variant={status === tab.value ? "default" : "outline"}
              onClick={() => setStatus(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {claims.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-2 py-8 text-[12px] font-bold text-muted-foreground">
              <ShieldQuestion className="size-4" aria-hidden />
              لا مطالبات في هذه الحالة.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {rows.map((claim) => (
              <Card key={claim.id}>
                <CardContent className="space-y-2 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {claim.place_slug ? (
                      <Link
                        to="/guides/syria_/$slug"
                        params={{ slug: claim.place_slug }}
                        className="text-[13px] font-black underline decoration-dotted"
                      >
                        {claim.place_name ?? "جهة"}
                      </Link>
                    ) : (
                      <span className="text-[13px] font-black">{claim.place_name ?? "جهة"}</span>
                    )}
                    <span className="text-[10.5px] font-bold text-muted-foreground">
                      {formatDateTime(claim.created_at)}
                    </span>
                  </div>

                  <p className="text-[11.5px] font-bold text-muted-foreground">
                    مقدّم الطلب: {claim.applicant_name ?? "—"} ·{" "}
                    {ROLE_LABEL[claim.applicant_role ?? ""] ?? claim.applicant_role ?? "—"} · جوال:{" "}
                    {claim.phone ?? claim.contact ?? "—"}{" "}
                    {claim.phone_verified_at ? "(موثّق برمز تحقق)" : "(غير موثّق)"}
                  </p>
                  {claim.evidence ? (
                    <p className="text-[11.5px] leading-6 text-muted-foreground">{claim.evidence}</p>
                  ) : null}

                  <div className="flex flex-wrap gap-1.5">
                    {claim.documents.length === 0 ? (
                      <span className="text-[11px] font-bold text-destructive">
                        {claim.documents_purged_at
                          ? "المستندات حُذفت بعد انتهاء مدة الاحتفاظ."
                          : "لا مستندات — لا يجوز الاعتماد."}
                      </span>
                    ) : (
                      claim.documents.map((doc) => (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => void openDocument(doc.storage_path)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border px-2.5 text-[11px] font-black hover:border-primary/50"
                        >
                          <FileText className="size-3.5" aria-hidden />
                          {CLAIM_DOC_KIND_LABEL[doc.doc_kind] ?? doc.doc_kind}
                        </button>
                      ))
                    )}
                  </div>

                  {claim.reject_reason ? (
                    <p className="text-[11px] font-bold text-destructive">
                      سبب الرفض: {claim.reject_reason}
                    </p>
                  ) : null}
                  {claim.reviewed_at ? (
                    <p className="text-[10.5px] font-bold text-muted-foreground">
                      بُتّ فيها: {formatDateTime(claim.reviewed_at)}
                    </p>
                  ) : null}

                  {status === "pending" ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <Button
                        size="sm"
                        disabled={decide.isPending || claim.documents.length === 0}
                        onClick={() =>
                          decide.mutate(
                            { claimId: claim.id, approve: true, reason: null },
                            {
                              onSuccess: () => toast.success("تم اعتماد المطالبة"),
                              onError: () => toast.error("تعذّر الاعتماد."),
                            },
                          )
                        }
                      >
                        اعتماد
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={decide.isPending}
                        onClick={() => {
                          const reason = window.prompt("سبب الرفض (يُعرض لمقدّم الطلب):");
                          if (!reason) return;
                          decide.mutate(
                            { claimId: claim.id, approve: false, reason: reason.trim() },
                            {
                              onSuccess: () => toast.success("تم رفض المطالبة"),
                              onError: () => toast.error("تعذّر الرفض."),
                            },
                          );
                        }}
                      >
                        رفض
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
