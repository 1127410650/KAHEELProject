import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldAlert } from "lucide-react";

import { useI18n } from "@/i18n";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Presentation primitives shared by every administrative detail file.
 *
 * They exist so the four files (user, business, listing, verification) look and
 * behave identically: same back link, same head, same tab strip, same
 * "unknown values render as a dash, never as an empty cell".
 */

export function DetailBack({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowRight className="size-4 rtl:rotate-0 ltr:rotate-180" aria-hidden />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const tones = {
    neutral: "bg-secondary text-muted-foreground",
    good: "bg-primary/10 text-primary",
    warn: "bg-gold-soft text-gold-dark",
    bad: "bg-destructive/10 text-destructive",
  } as const;
  return (
    <span className={`rounded-full px-2 py-0.5 text-desc font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function DetailHeader({
  title,
  subtitle,
  chips,
  actions,
}: {
  title: string;
  subtitle?: string | null | undefined;
  chips?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className=" text-base font-bold text-foreground sm:text-lg">{title}</p>
          {subtitle && (
            <p className="mt-0.5 text-desc text-muted-foreground">{subtitle}</p>
          )}
          {chips && <div className="mt-2 flex flex-wrap items-center gap-1.5">{chips}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function StatGrid({ items }: { items: { label: string; value: number | string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-border bg-card p-3">
          <p className="truncate text-desc text-muted-foreground">{item.label}</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-foreground">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function TabStrip({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string; count?: number | undefined }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div
      className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
      role="tablist"
      aria-label="tabs"
    >
      {tabs.map((tab) => {
        const on = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(tab.key)}
            className={
              "flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors " +
              (on
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground")
            }
          >
            <span className="whitespace-nowrap">{tab.label}</span>
            {typeof tab.count === "number" && tab.count > 0 && (
              <span className="rounded-full bg-secondary px-1.5 text-desc tabular-nums">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function InfoGrid({
  items,
}: {
  items: { label: string; value: React.ReactNode | null | undefined }[];
}) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-desc text-muted-foreground">{item.label}</dt>
          <dd className="mt-0.5 text-sm text-foreground">
            {item.value === null || item.value === undefined || item.value === "" ? "—" : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Panel({
  title,
  children,
  actions,
}: {
  title?: string | undefined;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-section font-bold text-foreground">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ label }: { label: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{label}</p>;
}

/** A vertical, newest-first history line: who, what, when, why. */
export function Timeline({
  items,
}: {
  items: {
    id: string;
    title: string;
    actor?: string | null | undefined;
    at: string;
    detail?: string | null | undefined;
  }[];
}) {
  const { t } = useI18n();
  if (items.length === 0) return <EmptyState label={t("common.noData")} />;
  return (
    <ol className="space-y-0">
      {items.map((item, index) => (
        <li key={item.id} className="flex gap-3">
          <div className="flex flex-col items-center pt-1.5">
            <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden />
            {index < items.length - 1 && <span className="w-px flex-1 bg-border" aria-hidden />}
          </div>
          <div className="min-w-0 flex-1 pb-4">
            <p className=" text-sm font-medium text-foreground">{item.title}</p>
            <p className="mt-0.5 text-desc tabular-nums text-muted-foreground">
              {formatDateTime(item.at)}
              {item.actor ? ` · ${item.actor}` : ""}
            </p>
            {item.detail && (
              <p className="mt-1 text-desc text-muted-foreground">{item.detail}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Card rows that stay readable on a 320 px screen — never a wide table. */
export function RowList({
  rows,
}: {
  rows: {
    id: string;
    to?: string | undefined;
    title: string;
    meta: string[];
    trailing?: React.ReactNode;
  }[];
}) {
  const { t } = useI18n();
  if (rows.length === 0) return <EmptyState label={t("common.noData")} />;
  return (
    <ul className="grid gap-2">
      {rows.map((row) => {
        const body = (
          <>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{row.title}</p>
              <p className="mt-0.5 truncate text-desc tabular-nums text-muted-foreground">
                {row.meta.filter(Boolean).join(" · ")}
              </p>
            </div>
            {row.trailing && <div className="shrink-0">{row.trailing}</div>}
          </>
        );
        return (
          <li key={row.id}>
            {row.to ? (
              <Link
                to={row.to}
                className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-border bg-background p-3 hover:bg-accent"
              >
                {body}
              </Link>
            ) : (
              <div className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-border bg-background p-3">
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export function DetailError({ message, backTo, backLabel }: { message: string; backTo: string; backLabel: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <ShieldAlert className="mx-auto size-6 text-muted-foreground" aria-hidden />
      <p className="mt-2 text-sm font-medium text-foreground">{message}</p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link to={backTo}>{backLabel}</Link>
      </Button>
    </div>
  );
}

/** Small helper for the "show more" pattern inside long history lists. */
export function useExpandable<T>(items: T[], step = 10) {
  const [limit, setLimit] = useState(step);
  return {
    visible: items.slice(0, limit),
    hasMore: items.length > limit,
    showMore: () => setLimit((value) => value + step),
  };
}
