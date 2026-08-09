import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  ChevronLeft,
  ChevronRight,
  Flag,
  Inbox,
  ListChecks,
  Megaphone,
  ShieldOff,
  Sparkles,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import { useI18n } from "@/i18n";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { loadAdminOverview } from "@/lib/mkt-platform";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "إدارة المنصة — گحيل" },
      {
        name: "description",
        content:
          "لوحة مدير النظام: نظرة سريعة على المستخدمين والمتاجر والإعلانات والبلاغات وطلبات التوثيق.",
      },
      { property: "og:title", content: "إدارة المنصة — گحيل" },
      { property: "og:description", content: "لوحة مدير النظام في منصة گحيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminHomePage,
});

type Tone = "teal" | "blue" | "amber" | "rose" | "violet" | "slate";

const TONES: Record<Tone, { icon: string; value: string; border: string; glow: string }> = {
  teal: {
    icon: "bg-[#e5f6f3] text-[#087f78] dark:bg-primary/15 dark:text-primary",
    value: "text-[#075e59] dark:text-foreground",
    border: "hover:border-[#8ccbc5]",
    glow: "from-[#e8f8f5]/80",
  },
  blue: {
    icon: "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300",
    value: "text-sky-900 dark:text-foreground",
    border: "hover:border-sky-300",
    glow: "from-sky-50/80",
  },
  amber: {
    icon: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
    value: "text-amber-900 dark:text-foreground",
    border: "hover:border-amber-300",
    glow: "from-amber-50/80",
  },
  rose: {
    icon: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300",
    value: "text-rose-900 dark:text-foreground",
    border: "hover:border-rose-300",
    glow: "from-rose-50/80",
  },
  violet: {
    icon: "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300",
    value: "text-violet-900 dark:text-foreground",
    border: "hover:border-violet-300",
    glow: "from-violet-50/80",
  },
  slate: {
    icon: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    value: "text-slate-900 dark:text-foreground",
    border: "hover:border-slate-300",
    glow: "from-slate-50/80",
  },
};

function Stat({
  label,
  value,
  icon: Icon,
  to,
  search,
  tone,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  to: string;
  search?: Record<string, string | boolean>;
  tone: Tone;
}) {
  const { dir } = useI18n();
  const Arrow = dir === "rtl" ? ChevronLeft : ChevronRight;
  const palette = TONES[tone];

  return (
    <Link
      to={to}
      search={search ?? {}}
      className={`group relative isolate min-h-[126px] overflow-hidden rounded-2xl border border-[#dcebea] bg-white p-4 shadow-[0_8px_24px_rgba(13,90,84,0.035)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(13,90,84,0.08)] dark:border-border dark:bg-card ${palette.border}`}
    >
      <div
        className={`pointer-events-none absolute -end-8 -top-10 -z-10 size-28 rounded-full bg-gradient-to-br ${palette.glow} to-transparent blur-2xl`}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-2">
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${palette.icon}`}>
          <Icon className="size-[17px]" aria-hidden />
        </span>
        <Arrow
          className="mt-1 size-4 text-muted-foreground/45 transition group-hover:text-[#087f78]"
          aria-hidden
        />
      </div>
      <div className="mt-3">
        <p className="truncate text-[11px] font-semibold text-muted-foreground sm:text-xs">
          {label}
        </p>
        <p
          className={`mt-1 text-2xl font-black tabular-nums tracking-tight sm:text-[28px] ${palette.value}`}
        >
          {value.toLocaleString("en-US")}
        </p>
      </div>
    </Link>
  );
}

function ActionRow({
  to,
  label,
  count,
  icon: Icon,
  search,
  urgent = false,
}: {
  to: string;
  label: string;
  count: number;
  icon: LucideIcon;
  search?: Record<string, string | boolean>;
  urgent?: boolean;
}) {
  const { dir } = useI18n();
  const Arrow = dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <Link
      to={to}
      search={search ?? {}}
      className="group flex min-h-[68px] items-center gap-3 rounded-2xl border border-[#dcebea] bg-[#fbfdfd] px-3.5 py-3 transition hover:border-[#9bcfc9] hover:bg-white hover:shadow-sm dark:border-border dark:bg-background"
    >
      <span
        className={
          "grid size-10 shrink-0 place-items-center rounded-xl " +
          (urgent && count > 0
            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
            : "bg-[#e5f6f3] text-[#087f78] dark:bg-primary/15 dark:text-primary")
        }
      >
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold text-foreground sm:text-sm">{label}</span>
        <span className="mt-0.5 block text-[10px] text-muted-foreground">
          {count > 0 ? "بانتظار المراجعة أو الإجراء" : "لا توجد عناصر معلّقة"}
        </span>
      </span>
      <span
        className={
          "grid min-w-8 shrink-0 place-items-center rounded-full px-2 py-1 text-[11px] font-black tabular-nums " +
          (count > 0
            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
            : "bg-secondary text-muted-foreground")
        }
      >
        {count}
      </span>
      <Arrow
        className="size-4 shrink-0 text-muted-foreground/45 transition group-hover:text-[#087f78]"
        aria-hidden
      />
    </Link>
  );
}

function AdminHomePage() {
  const { t } = useI18n();
  const overview = useQuery({
    queryKey: ["mkt", "admin", "overview"],
    queryFn: loadAdminOverview,
    staleTime: 30_000,
  });
  const data = overview.data;

  return (
    <AdminShell title={t("admin.console")}>
      {overview.isLoading || !data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, index) => (
            <Skeleton key={index} className="h-[126px] w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <section className="relative overflow-hidden rounded-2xl border border-[#cfe5e2] bg-gradient-to-l from-[#087f78] via-[#0b9188] to-[#13a096] px-4 py-4 text-white shadow-[0_14px_34px_rgba(8,127,120,0.16)] sm:px-5 sm:py-5">
            <div
              className="absolute -start-10 -top-16 size-44 rounded-full bg-white/10 blur-3xl"
              aria-hidden
            />
            <div
              className="absolute -bottom-20 end-10 size-48 rounded-full bg-cyan-200/10 blur-3xl"
              aria-hidden
            />
            <div className="relative flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-bold backdrop-blur">
                  <Sparkles className="size-3.5" aria-hidden />
                  {t("admin.dashboardBadge")}
                </span>
                <h2 className="mt-2 text-lg font-black sm:text-2xl">
                  {t("admin.dashboardWelcome")}
                </h2>
                <p className="mt-1 max-w-2xl text-[11px] leading-5 text-white/75 sm:text-sm sm:leading-6">
                  {t("admin.dashboardIntro")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/15 bg-black/10 px-3 py-2 backdrop-blur">
                <span className="text-[10px] text-white/70">{t("admin.dashboardPending")}</span>
                <strong className="text-xl font-black tabular-nums">
                  {data.listings_pending + data.reports_new + data.verifications_pending}
                </strong>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-foreground sm:text-base">
                  {t("admin.dashboardOverview")}
                </h2>
                <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
                  {t("admin.dashboardOverviewHint")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              <Stat
                label={t("admin.stats.users")}
                value={data.users}
                icon={Users}
                to="/admin/users"
                tone="teal"
              />
              <Stat
                label={t("admin.stats.businesses")}
                value={data.businesses}
                icon={Building2}
                to="/admin/businesses"
                tone="blue"
              />
              <Stat
                label={t("admin.stats.published")}
                value={data.listings_published}
                icon={Megaphone}
                to="/admin/listings"
                search={{ status: "published" }}
                tone="teal"
              />
              <Stat
                label={t("admin.stats.pending")}
                value={data.listings_pending}
                icon={Megaphone}
                to="/admin/listings"
                search={{ status: "pending" }}
                tone="amber"
              />
              <Stat
                label={t("admin.stats.reports")}
                value={data.reports_new}
                icon={Flag}
                to="/admin/listing-reports"
                search={{ status: "new" }}
                tone="rose"
              />
              <Stat
                label={t("admin.stats.verifications")}
                value={data.verifications_pending}
                icon={BadgeCheck}
                to="/admin/verifications"
                search={{ status: "pending" }}
                tone="violet"
              />
              <Stat
                label={t("admin.stats.restricted")}
                value={data.restricted_accounts}
                icon={ShieldOff}
                to="/admin/users"
                search={{ restricted: true }}
                tone="slate"
              />
              <Stat
                label={t("admin.stats.suggestions")}
                value={data.activity_suggestions}
                icon={ListChecks}
                to="/admin/taxonomy"
                search={{ tab: "suggestions" }}
                tone="blue"
              />
              <Stat
                label={t("admin.stats.banned")}
                value={data.banned_accounts}
                icon={ShieldOff}
                to="/admin/users"
                search={{ restricted: true, state: "banned" }}
                tone="rose"
              />
              <Stat
                label={t("admin.stats.unassigned")}
                value={data.unassigned_requests}
                icon={Inbox}
                to="/admin/listings"
                search={{ status: "pending", queue: "unassigned" }}
                tone="amber"
              />
              <Stat
                label={t("admin.stats.assignedToMe")}
                value={data.assigned_to_me}
                icon={UserCheck}
                to="/admin/listings"
                search={{ queue: "mine" }}
                tone="teal"
              />
              <Stat
                label={t("admin.stats.urgent")}
                value={data.urgent_actions}
                icon={AlertTriangle}
                to="/admin/listing-reports"
                search={{ status: "new" }}
                tone="rose"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-[#dcebea] bg-white p-4 shadow-[0_8px_24px_rgba(13,90,84,0.035)] dark:border-border dark:bg-card sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-foreground">{t("admin.actionNeeded")}</h2>
                <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
                  {t("admin.actionNeededHint")}
                </p>
              </div>
              <span className="rounded-full bg-[#e5f6f3] px-3 py-1 text-[10px] font-black text-[#087f78] dark:bg-primary/15 dark:text-primary">
                {data.listings_pending +
                  data.reports_new +
                  data.verifications_pending +
                  data.activity_suggestions}
              </span>
            </div>

            <div className="mt-4 grid gap-2.5 md:grid-cols-2">
              <ActionRow
                to="/admin/listings"
                label={t("admin.alerts.listingsPending")}
                count={data.listings_pending}
                icon={Megaphone}
                search={{ status: "pending" }}
              />
              <ActionRow
                to="/admin/listing-reports"
                label={t("admin.alerts.reportsNew")}
                count={data.reports_new}
                icon={Flag}
                search={{ status: "new" }}
                urgent
              />
              <ActionRow
                to="/admin/verifications"
                label={t("admin.alerts.verifications")}
                count={data.verifications_pending}
                icon={BadgeCheck}
                search={{ status: "pending" }}
              />
              <ActionRow
                to="/admin/taxonomy"
                label={t("admin.alerts.activitySuggestions")}
                count={data.activity_suggestions}
                icon={ListChecks}
                search={{ tab: "suggestions" }}
              />
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
