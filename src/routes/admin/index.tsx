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
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "إدارة المنصة — كَحيل" },
      {
        name: "description",
        content:
          "لوحة مدير النظام: نظرة سريعة على المستخدمين والمتاجر والإعلانات والبلاغات وطلبات التوثيق.",
      },
      { property: "og:title", content: "إدارة المنصة — كَحيل" },
      { property: "og:description", content: "لوحة مدير النظام في منصة كَحيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminHomePage,
});

type Tone = "teal" | "blue" | "amber" | "rose" | "violet" | "slate";

// كل النغمات من design tokens الخاصة بلوحة الإدارة — لا قيمة لون مباشرة هنا.
const TONES: Record<Tone, { icon: string; value: string; border: string; glow: string }> = {
  teal: {
    icon: "bg-primary/12 text-primary dark:bg-primary/15 dark:text-primary",
    value: "text-primary-pressed dark:text-foreground",
    border: "hover:border-primary/45",
    glow: "from-primary/8",
  },
  blue: {
    icon: "bg-admin-progress-soft text-admin-progress",
    value: "text-admin-progress dark:text-foreground",
    border: "hover:border-admin-progress/45",
    glow: "from-admin-progress-soft/80",
  },
  amber: {
    icon: "bg-admin-pending-soft text-admin-pending",
    value: "text-admin-pending dark:text-foreground",
    border: "hover:border-admin-pending/45",
    glow: "from-admin-pending-soft/80",
  },
  rose: {
    icon: "bg-admin-critical-soft text-admin-critical",
    value: "text-admin-critical dark:text-foreground",
    border: "hover:border-admin-critical/45",
    glow: "from-admin-critical-soft/80",
  },
  violet: {
    icon: "bg-admin-verify-soft text-admin-verify",
    value: "text-admin-verify dark:text-foreground",
    border: "hover:border-admin-verify/45",
    glow: "from-admin-verify-soft/80",
  },
  slate: {
    icon: "bg-admin-idle-soft text-admin-idle",
    value: "text-admin-idle dark:text-foreground",
    border: "hover:border-admin-idle/40",
    glow: "from-admin-idle-soft/80",
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
      className={`group relative isolate min-h-[126px] overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-panel transition duration-200 hover:-translate-y-0.5 hover:shadow-raised dark:border-border dark:bg-card ${palette.border}`}
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
          className="mt-1 size-4 text-muted-foreground/45 transition group-hover:text-primary"
          aria-hidden
        />
      </div>
      <div className="mt-3">
        <p className="truncate text-desc font-semibold text-muted-foreground sm:text-desc">
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
      className="group flex min-h-[68px] items-center gap-3 rounded-2xl border border-border bg-secondary/45 px-3.5 py-3 transition hover:border-primary/40 hover:bg-card hover:shadow-sm dark:border-border dark:bg-background"
    >
      <span
        className={
          "grid size-10 shrink-0 place-items-center rounded-xl " +
          (urgent && count > 0
            ? "bg-admin-critical-soft text-admin-critical"
            : "bg-primary/12 text-primary")
        }
      >
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-desc font-bold text-foreground sm:text-sm">{label}</span>
        <span className="mt-0.5 block text-desc text-muted-foreground">
          {count > 0 ? "بانتظار المراجعة أو الإجراء" : "لا توجد عناصر معلّقة"}
        </span>
      </span>
      <span
        className={
          "grid min-w-8 shrink-0 place-items-center rounded-full px-2 py-1 text-desc font-black tabular-nums " +
          (count > 0
            ? "bg-admin-critical-soft text-admin-critical"
            : "bg-secondary text-muted-foreground")
        }
      >
        {count}
      </span>
      <Arrow
        className="size-4 shrink-0 text-muted-foreground/45 transition group-hover:text-primary"
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
          <section className="relative overflow-hidden rounded-2xl border border-primary/35 bg-gradient-to-l from-primary-pressed via-primary to-primary-dark px-4 py-4 text-primary-foreground shadow-raised sm:px-5 sm:py-5">
            <div
              className="absolute -start-10 -top-16 size-44 rounded-full bg-white/10 blur-3xl"
              aria-hidden
            />
            <div
              className="absolute -bottom-20 end-10 size-48 rounded-full bg-primary-foreground/10 blur-3xl"
              aria-hidden
            />
            <div className="relative flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-desc font-bold backdrop-blur">
                  <Sparkles className="size-3.5" aria-hidden />
                  {t("admin.dashboardBadge")}
                </span>
                <h2 className="mt-2 text-lg font-black sm:text-2xl">
                  {t("admin.dashboardWelcome")}
                </h2>
                <p className="mt-1 max-w-2xl text-desc leading-5 text-white/75 sm:text-sm sm:leading-6">
                  {t("admin.dashboardIntro")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/15 bg-black/10 px-3 py-2 backdrop-blur">
                <span className="text-desc text-white/70">{t("admin.dashboardPending")}</span>
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
                <p className="mt-0.5 text-desc text-muted-foreground sm:text-desc">
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

          <section className="rounded-2xl border border-border bg-card p-4 shadow-panel sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-foreground">{t("admin.actionNeeded")}</h2>
                <p className="mt-0.5 text-desc text-muted-foreground sm:text-desc">
                  {t("admin.actionNeededHint")}
                </p>
              </div>
              <span className="rounded-full bg-primary/12 px-3 py-1 text-desc font-black text-primary">
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
