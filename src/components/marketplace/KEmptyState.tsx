/**
 * حالة الفراغ الفاخرة الموحّدة لكل أسطح كَحيل.
 *
 * القاعدة: لا حالة فراغ نصية مجرّدة أبدًا — أيقونة/رسم + عنوان + تلميح + إجراء،
 * وبحاشية سخية 32px (`--sp-8`) وتباعد داخلي من رموز شبكة 8pt فقط.
 */

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function KEmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string | undefined;
  action?: ReactNode;
  className?: string | undefined;
}) {
  return (
    <div className={`k-empty ${className ?? ""}`}>
      <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="text-[18px] font-bold leading-[1.3] text-foreground">{title}</p>
      {hint ? (
        <p className="max-w-[42ch] text-[14px] font-medium leading-[1.6] text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {action ? <div className="mt-[var(--sp-1)] flex flex-wrap justify-center gap-[var(--sp-2)]">{action}</div> : null}
    </div>
  );
}
