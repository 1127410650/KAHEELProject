/**
 * صندوق سلامة المحتوى — يظهر في «أعمالي» ليكون العمل واضحًا لمن ينفّذه.
 * الملاحظات تأتي من مهمة الفحص الخلفية `mkt_content_health_scan` وتُغلق تلقائيًا
 * عندما يزول السبب، فلا قائمة تتضخم بلا نهاية.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { LinkIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { AdminCard, AdminEmptyState } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatNumber } from "@/lib/format";
import {
  CONTENT_CHECK_LABEL_AR,
  SEVERITY_LABEL_AR,
  loadContentHealth,
  runContentHealthScan,
} from "@/lib/mkt-reliability";

const KEY = ["mkt", "admin", "content-health"];

export function ContentHealthBox({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const findings = useQuery({
    queryKey: KEY,
    enabled,
    queryFn: () => loadContentHealth(20),
    retry: false,
  });

  const scan = useMutation({
    mutationFn: runContentHealthScan,
    onSuccess: (result) => {
      toast.success(`اكتمل الفحص — ${formatNumber(result.open_found)} ملاحظة قائمة.`);
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
    onError: () => toast.error("تعذّر تشغيل الفحص — تحتاج صلاحية عرض صحة المنصة."),
  });

  if (!enabled) return null;
  const rows = findings.data ?? [];

  return (
    <AdminCard
      title="سلامة المحتوى والروابط"
      description="روابط مكسورة، وسائط ناقصة، وحملات منتهية — من مهمة الفحص الخلفية."
      accent={rows.some((r) => r.severity === "P0" || r.severity === "P1")}
      action={
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="k-press"
          disabled={scan.isPending}
          onClick={() => scan.mutate()}
        >
          <RefreshCw aria-hidden className={"size-4 " + (scan.isPending ? "animate-spin" : "")} />
          فحص الآن
        </Button>
      }
    >
      {rows.length === 0 ? (
        <AdminEmptyState
          icon={LinkIcon}
          title="لا ملاحظة قائمة"
          hint="لا رابط مكسور ولا وسائط ناقصة ولا حملة منتهية مفعّلة."
        />
      ) : (
        <ul className="grid gap-[var(--sp-2)]">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-[var(--r-inner)] border border-border p-[var(--sp-3)]"
            >
              <p className="text-[14px] font-semibold text-foreground">
                {row.title_ar}
                <span className="ms-2 text-[12px] text-muted-foreground">
                  {CONTENT_CHECK_LABEL_AR[row.check_key] ?? row.check_key} ·{" "}
                  {SEVERITY_LABEL_AR[row.severity] ?? row.severity}
                </span>
              </p>
              {row.detail_ar ? (
                <p className="mt-1 text-[13px] text-muted-foreground">{row.detail_ar}</p>
              ) : null}
              <p className="mt-1 text-[12px] text-muted-foreground">
                آخر ظهور {formatDateTime(row.last_seen_at)} · تكرار{" "}
                {formatNumber(row.occurrence_count)}
              </p>
              {row.href ? (
                <Link
                  to={row.href}
                  className="mt-2 inline-block text-[13px] font-medium text-primary underline"
                >
                  معالجة
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );
}
