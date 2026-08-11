/**
 * سقالة صفحات الإدارة — نفس نظام 8pt وأنصاف الأقطار (14/12) وتشريح البطاقة
 * المستخدم في الواجهة العامة. كل لون من رموز اللوحة المفعّلة، ولا قيمة لون
 * مباشرة في هذا الملف ولا في الصفحات التي تستخدمه.
 */
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { KEmptyState } from "@/components/marketplace/KEmptyState";

/** عنوان الصفحة (18/700) + وصف سطر واحد (14 خفيف) + صف الإجراءات. */
export function AdminPageHead({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="k-fade-up mb-[var(--sp-4)] grid grid-cols-[minmax(0,1fr)_auto] items-start gap-[var(--sp-3)] sm:flex sm:flex-wrap sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="truncate text-[18px] font-bold leading-tight text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-[14px] leading-snug text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** بطاقة قسم: p-4 + حاشية بادئة 3px بلون اللوحة. */
export function AdminCard({
  title,
  description,
  actions,
  children,
  accent = true,
  className = "",
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <section
      className={
        "k-fade-up overflow-hidden rounded-[var(--r-card)] border border-border bg-card p-[var(--sp-4)] shadow-[0_8px_30px_rgba(0,0,0,0.04)] " +
        (accent ? "border-s-[3px] border-s-primary " : "") +
        className
      }
    >
      {title || actions ? (
        <div className="mb-[var(--sp-3)] grid grid-cols-[minmax(0,1fr)_auto] items-start gap-[var(--sp-2)] sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            {title ? (
              <h3 className="truncate text-[16px] font-bold text-foreground">{title}</h3>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-[14px] text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** غلاف تمرير للجداول — لا تجاوز أفقي على 390px. */
export function AdminTableScroll({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-[var(--sp-4)] overflow-x-auto px-[var(--sp-4)]">
      <div className="min-w-[640px]">{children}</div>
    </div>
  );
}

/**
 * حالة الفراغ في الإدارة = نفس حالة الفراغ الموحّدة في المنصة.
 *
 * كانت هذه نسخة ثانية بنفس الشكل والخصائص، فصارت غلافًا رقيقًا حول
 * `KEmptyState` مع إطار الإدارة المتقطّع فقط — مكوّن واحد لا اثنان.
 */
export function AdminEmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <KEmptyState
      icon={icon}
      title={title}
      hint={hint}
      action={action}
      className="rounded-[var(--r-card)] border border-dashed border-border bg-secondary/40"
    />
  );
}

