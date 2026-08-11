/**
 * قائمة فحص ما قبل النشر — يراها الناشر صريحة قبل الضغط على «نشر».
 * البنود المانعة تُعطّل النشر، والتحذيرات تُعرض ولا تمنع.
 */
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import { AdminCard } from "@/components/admin/AdminPage";
import type { PreflightItem } from "@/lib/mkt-cms";

export function PreflightList({ items }: { items: PreflightItem[] }) {
  const blocking = items.filter((i) => i.blocking);
  const warnings = items.filter((i) => !i.blocking);

  return (
    <AdminCard
      title="فحص ما قبل النشر"
      description={
        blocking.length > 0
          ? `${blocking.length} بند مانع للنشر`
          : warnings.length > 0
            ? `${warnings.length} تحذير — النشر متاح`
            : "جاهزة للنشر"
      }
      accent={blocking.length > 0}
    >
      {items.length === 0 ? (
        <p className="flex items-center gap-2 text-desc text-muted-foreground">
          <CheckCircle2 aria-hidden className="size-4 text-success" />
          لا ملاحظات — كل الحقول والوجهات والترجمات مكتملة.
        </p>
      ) : (
        <ul className="space-y-2">
          {[...blocking, ...warnings].map((item, index) => (
            <li key={`${item.code}-${index}`} className="flex items-start gap-2 text-desc">
              {item.blocking ? (
                <XCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
              ) : (
                <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
              )}
              <span className="min-w-0 text-foreground">{item.message}</span>
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );
}
