/**
 * Admin queue for guide correction / removal requests. Statuses move
 * new → reviewing → done | rejected, and executing a removal unpublishes the
 * linked record with a reason and a date instead of deleting it.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileWarning } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/marketplace/AdminShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import {
  REMOVAL_STATUS_LABEL,
  REMOVAL_TYPE_LABEL,
  useDecideGuideRemovalRequest,
  useGuideRemovalQueue,
  type RemovalRequestStatus,
} from "@/lib/mkt-guide-legal";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/admin/guide-requests")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "طلبات تعديل وإزالة الدليل — لوحة مدير النظام" },
      {
        name: "description",
        content: "طابور طلبات تصحيح بيانات جهات الدليل وإزالتها، مع إزالة ناعمة تسجّل السبب.",
      },
      { property: "og:title", content: "طلبات تعديل وإزالة الدليل" },
      { property: "og:description", content: "مراجعة طلبات التصحيح والإزالة." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminGuideRequestsPage,
});

const TABS: RemovalRequestStatus[] = ["new", "reviewing", "done", "rejected"];

function AdminGuideRequestsPage() {
  const { session } = useSession();
  const [status, setStatus] = useState<RemovalRequestStatus>("new");
  const queue = useGuideRemovalQueue(true, status);
  const decide = useDecideGuideRemovalRequest(session?.user.id ?? null);

  const rows = queue.data ?? [];

  return (
    <AdminShell title="طلبات تعديل وإزالة الدليل">
      <div className="space-y-4">
        <div>
          <h1 className="text-page font-black">طلبات تعديل وإزالة الدليل</h1>
          <p className="text-desc text-muted-foreground">
            الإزالة تُنفَّذ كإخفاء من العرض العام مع تسجيل السبب والتاريخ — بلا حذف نهائي.
          </p>
        </div>

        <div className="flex flex-wrap gap-[var(--sp-2)]">
          {TABS.map((tab) => (
            <Button
              key={tab}
              size="sm"
              variant={status === tab ? "default" : "outline"}
              onClick={() => setStatus(tab)}
            >
              {REMOVAL_STATUS_LABEL[tab]}
            </Button>
          ))}
        </div>

        {queue.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-2 py-8 text-desc font-bold text-muted-foreground">
              <FileWarning className="size-4" aria-hidden />
              لا طلبات في هذه الحالة.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <Card key={row.id}>
                <CardContent className="space-y-2 py-[var(--sp-4)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-desc font-black">{row.entity_name}</span>
                    <span className="rounded-full border border-primary/30 bg-primary/8 px-2 py-0.5 text-desc font-black text-primary">
                      {REMOVAL_TYPE_LABEL[row.request_type]}
                    </span>
                    <span className="text-desc font-bold text-muted-foreground">
                      {formatDateTime(row.created_at)}
                    </span>
                  </div>
                  <p className="text-desc leading-6 text-muted-foreground">{row.description}</p>
                  <p className="text-desc font-bold text-muted-foreground">
                    صفة المُبلِّغ: {row.reporter_role} · تواصل: {row.contact}
                  </p>
                  {row.place_id ? (
                    <p className="text-desc font-bold text-muted-foreground">
                      سجل مرتبط في الدليل ✓
                    </p>
                  ) : (
                    <p className="text-desc font-bold text-muted-foreground">
                      لا سجل مرتبط — ابحث عن الجهة في{" "}
                      <Link to="/guides/syria" className="underline decoration-dotted">
                        الدليل
                      </Link>
                    </p>
                  )}
                  {row.decision_note ? (
                    <p className="text-desc font-bold text-foreground">
                      ملاحظة القرار: {row.decision_note}
                    </p>
                  ) : null}
                  {row.reviewed_at ? (
                    <p className="text-desc font-bold text-muted-foreground">
                      بُتّ فيه: {formatDateTime(row.reviewed_at)}
                    </p>
                  ) : null}

                  {status !== "done" && status !== "rejected" ? (
                    <div className="flex flex-wrap gap-[var(--sp-2)] pt-1">
                      {status === "new" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={decide.isPending}
                          onClick={() =>
                            decide.mutate(
                              { request: row, status: "reviewing", note: null },
                              {
                                onSuccess: () => toast.success("انتقل إلى قيد المراجعة"),
                                onError: () => toast.error("تعذّر تحديث الطلب."),
                              },
                            )
                          }
                        >
                          قيد المراجعة
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        disabled={decide.isPending}
                        onClick={() => {
                          const note = window.prompt(
                            row.request_type === "removal"
                              ? "سبب الإزالة (يُسجَّل على السجل):"
                              : "ملاحظة التنفيذ:",
                          );
                          if (note === null) return;
                          decide.mutate(
                            { request: row, status: "done", note: note.trim() || null },
                            {
                              onSuccess: () => toast.success("تم تنفيذ الطلب"),
                              onError: () => toast.error("تعذّر تنفيذ الطلب."),
                            },
                          );
                        }}
                      >
                        تنفيذ
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={decide.isPending}
                        onClick={() => {
                          const note = window.prompt("سبب الرفض:");
                          if (!note) return;
                          decide.mutate(
                            { request: row, status: "rejected", note: note.trim() },
                            {
                              onSuccess: () => toast.success("تم رفض الطلب"),
                              onError: () => toast.error("تعذّر رفض الطلب."),
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
