import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Mobile presentation primitives.
 *
 * Every list screen shows the same shape on phones: one record per card,
 * headline first, status as a badge, secondary fields underneath and the
 * actions last. Desktop keeps its table (`hidden sm:block`).
 */

export interface RecordField {
  label: string;
  value: ReactNode;
  /** render the value with the latin-numerals class */
  num?: boolean;
  /** span the full card width instead of half */
  wide?: boolean;
  /** force LTR (invoice numbers, phones, tax numbers) */
  ltr?: boolean;
}

export function MobileCards({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ul className={cn("flex min-w-0 flex-col gap-2 sm:hidden", className)}>{children}</ul>
  );
}

export function MobileEmpty({ children }: { children: ReactNode }) {
  return (
    <li className="surface p-6 text-center text-[13px] text-muted-foreground">{children}</li>
  );
}

export function RecordCard({
  title,
  subtitle,
  lead,
  badge,
  fields = [],
  actions,
  footer,
  onClick,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** small leading identifier, e.g. serial or code */
  lead?: ReactNode;
  badge?: ReactNode;
  fields?: RecordField[];
  actions?: ReactNode;
  footer?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const head = (
    <div className="flex min-w-0 items-start gap-2">
      <div className="min-w-0 flex-1">
        {lead != null && (
          <span className="num block text-[10.5px] font-medium text-muted-foreground">{lead}</span>
        )}
        <span className="block wrap-anywhere text-[13.5px] font-semibold leading-snug">
          {title}
        </span>
        {subtitle != null && (
          <span className="mt-0.5 block wrap-anywhere text-[11.5px] leading-snug text-muted-foreground">
            {subtitle}
          </span>
        )}
      </div>
      {badge != null && <span className="shrink-0">{badge}</span>}
    </div>
  );

  return (
    <li className={cn("surface min-w-0 overflow-hidden p-3", className)}>
      {onClick ? (
        <button type="button" onClick={onClick} className="block w-full text-start">
          {head}
        </button>
      ) : (
        head
      )}

      {fields.length > 0 && (
        <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border pt-2.5 text-[11.5px]">
          {fields.map((field, index) => (
            <div
              key={`${field.label}-${index}`}
              className={cn("min-w-0", field.wide && "col-span-2")}
            >
              <dt className="truncate text-[10.5px] text-muted-foreground">{field.label}</dt>
              <dd
                dir={field.ltr ? "ltr" : undefined}
                className={cn(
                  "wrap-anywhere font-medium leading-snug",
                  field.num && "num",
                  field.ltr && "text-start",
                )}
              >
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {footer}

      {actions && (
        <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-1 border-t border-border pt-2">
          {actions}
        </div>
      )}
    </li>
  );
}
