/**
 * Central operations & analytics dashboard.
 *
 * Every number on this page comes from a `SECURITY DEFINER` RPC that re-checks
 * platform-admin identity on the server; there is no mock or placeholder data.
 * When a section has nothing to show it says so instead of inventing values.
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useI18n } from "@/i18n";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { Skeleton } from "@/components/ui/skeleton";
import {
  loadAnalyticsFields,
  loadAnalyticsFunnel,
  loadAnalyticsGeo,
  loadAnalyticsHealth,
  loadAnalyticsListings,
  loadAnalyticsOps,
  loadAnalyticsOverview,
  loadAnalyticsPeople,
  loadAnalyticsSearch,
  loadAnalyticsTimeseries,
  type NamedMetric,
} from "@/lib/mkt-analytics";

export const Route = createFileRoute("/admin/dashboard")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "منصة التحليلات والتشغيل — كَحيل" },
      {
        name: "description",
        content:
          "لوحة التحليلات والتشغيل المركزية: المستخدمون، الإعلانات، المجالات، البحث، الأداء، الأمان، والمحادثات.",
      },
      { property: "og:title", content: "منصة التحليلات والتشغيل — كَحيل" },
      { property: "og:description", content: "تحليلات حية للسوق العام ولوحة مدير النظام." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AnalyticsDashboardPage,
});

const RANGES = [7, 30, 90] as const;
const NUM = new Intl.NumberFormat("en-US");
const n = (v: number | null | undefined) => NUM.format(Math.round(Number(v ?? 0)));

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-bold text-foreground">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-foreground" dir="ltr">
        {value}
      </p>
    </div>
  );
}

/** Ranked list of named metrics; renders an explicit empty state. */
function Ranked({
  title,
  rows,
  empty,
  locale,
}: {
  title: string;
  rows: NamedMetric[] | undefined;
  empty: string;
  locale: string;
}) {
  const label = (r: NamedMetric) =>
    r.title ??
    r.term ??
    r.path ??
    (locale === "ar" ? (r.name_ar ?? r.name) : (r.name_en ?? r.name_ar ?? r.name)) ??
    r.message ??
    r.event_type ??
    "—";
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <h3 className="text-xs font-bold text-foreground">{title}</h3>
      {!rows || rows.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ol className="mt-2 space-y-1">
          {rows.map((r, i) => (
            <li key={`${label(r)}-${i}`} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-foreground">{label(r)}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground" dir="ltr">
                {n(r.metric)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function AnalyticsDashboardPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [days, setDays] = useState<number>(30);
  const opts = { staleTime: 30_000, refetchInterval: 60_000 } as const;

  const overview = useQuery({ queryKey: ["an", "overview"], queryFn: loadAnalyticsOverview, ...opts });
  const funnel = useQuery({ queryKey: ["an", "funnel", days], queryFn: () => loadAnalyticsFunnel(days), ...opts });
  const series = useQuery({ queryKey: ["an", "ts", days], queryFn: () => loadAnalyticsTimeseries(days), ...opts });
  const listings = useQuery({ queryKey: ["an", "listings"], queryFn: () => loadAnalyticsListings(10), ...opts });
  const fields = useQuery({ queryKey: ["an", "fields", days], queryFn: () => loadAnalyticsFields(days), ...opts });
  const search = useQuery({ queryKey: ["an", "search", days], queryFn: () => loadAnalyticsSearch(days), ...opts });
  const people = useQuery({ queryKey: ["an", "people", days], queryFn: () => loadAnalyticsPeople(days), ...opts });
  const health = useQuery({ queryKey: ["an", "health", days], queryFn: () => loadAnalyticsHealth(days), ...opts });
  const ops = useQuery({ queryKey: ["an", "ops", days], queryFn: () => loadAnalyticsOps(days), ...opts });
  const geo = useQuery({ queryKey: ["an", "geo"], queryFn: () => loadAnalyticsGeo(12), ...opts });

  /*
   * Live refresh without exposing raw traffic rows: the event table is
   * deliberately not readable by the client, so the page re-runs the guarded
   * aggregate RPCs on a 60s interval and whenever the tab regains focus.
   */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void qc.invalidateQueries({ queryKey: ["an"] });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [qc]);

  const chartRows = useMemo(
    () =>
      (series.data ?? []).map((d) => ({
        day: d.day.slice(5),
        users: d.users,
        listings: d.listings,
        views: d.views,
        messages: d.messages,
        searches: d.searches,
      })),
    [series.data],
  );

  const fieldRows = useMemo(
    () => [...(fields.data ?? [])].sort((a, b) => b.listings - a.listings),
    [fields.data],
  );

  const o = overview.data;
  const empty = t("admin.analytics.noData");

  return (
    <AdminShell title={t("admin.analytics.title")}>
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setDays(r)}
            className={
              "min-h-9 rounded-lg border px-3 text-xs font-semibold transition-colors " +
              (days === r
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-accent")
            }
          >
            {t("admin.analytics.lastDays").replace("{n}", String(r))}
          </button>
        ))}
        {o && (
          <span className="text-xs text-muted-foreground" dir="ltr">
            {new Date(o.generated_at).toLocaleString("en-GB", { timeZone: "Asia/Riyadh", hour12: false })}
          </span>
        )}
      </div>

      {overview.isLoading || !o ? (
        <Skeleton className="mt-4 h-40 w-full rounded-xl" />
      ) : (
        <Section title={t("admin.analytics.live")}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            <Tile label={t("admin.analytics.activeUsers")} value={n(o.active_users_today)} />
            <Tile label={t("admin.analytics.sessions")} value={n(o.active_sessions_today)} />
            <Tile label={t("admin.analytics.newUsers")} value={n(o.new_users_today)} />
            <Tile label={t("admin.analytics.totalUsers")} value={n(o.total_users)} />
            <Tile label={t("admin.analytics.businesses")} value={n(o.total_businesses)} />
            <Tile label={t("admin.analytics.published")} value={n(o.listings_published)} />
            <Tile label={t("admin.analytics.pending")} value={n(o.listings_pending)} />
            <Tile label={t("admin.analytics.featured")} value={n(o.listings_featured)} />
            <Tile label={t("admin.analytics.expired")} value={n(o.listings_expired)} />
            <Tile label={t("admin.analytics.conversations")} value={n(o.conversations_today)} />
            <Tile label={t("admin.analytics.messages")} value={n(o.messages_today)} />
            <Tile label={t("admin.analytics.calls")} value={n(o.calls_today)} />
            <Tile label={t("admin.analytics.reportsOpen")} value={n(o.reports_open)} />
            <Tile label={t("admin.analytics.verifPending")} value={n(o.verifications_pending)} />
            <Tile label={t("admin.analytics.quotesOpen")} value={n(o.quote_requests_open)} />
            <Tile label={t("admin.analytics.pointsSpent")} value={n(o.revenue_points_spent)} />
          </div>
          {!o.revenue_money_enabled && (
            <p className="mt-3 text-xs text-muted-foreground">{t("admin.analytics.noMoney")}</p>
          )}
        </Section>
      )}

      <Section title={t("admin.analytics.trend")} hint={t("admin.analytics.trendHint")}>
        {chartRows.length === 0 ? (
          <p className="text-xs text-muted-foreground">{empty}</p>
        ) : (
          <div className="h-72 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="views" stroke="#071A3D" fill="#071A3D" fillOpacity={0.15} />
                <Area type="monotone" dataKey="listings" stroke="#2563eb" fill="#2563eb" fillOpacity={0.15} />
                <Area type="monotone" dataKey="messages" stroke="#0f766e" fill="#0f766e" fillOpacity={0.12} />
                <Area type="monotone" dataKey="searches" stroke="#a16207" fill="#a16207" fillOpacity={0.12} />
                <Area type="monotone" dataKey="users" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.12} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      <Section title={t("admin.analytics.funnel")} hint={t("admin.analytics.funnelHint")}>
        {!funnel.data || funnel.data.steps.length === 0 ? (
          <p className="text-xs text-muted-foreground">{empty}</p>
        ) : (
          <div className="space-y-2">
            {funnel.data.steps.map((s) => {
              const top = Math.max(...funnel.data!.steps.map((x) => x.value), 1);
              return (
                <div key={s.key}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-foreground">{t(`admin.analytics.step.${s.key}`)}</span>
                    <span className="tabular-nums text-muted-foreground" dir="ltr">
                      {n(s.value)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(2, (s.value / top) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title={t("admin.analytics.fields")}>
        {fieldRows.length === 0 ? (
          <p className="text-xs text-muted-foreground">{empty}</p>
        ) : (
          <>
            <div className="h-72 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fieldRows.slice(0, 12).map((f) => ({ name: f.slug, listings: f.listings, views: f.views }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="listings" fill="#071A3D" />
                  <Bar dataKey="views" fill="#94a3b8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="p-2 text-start">{t("admin.analytics.field")}</th>
                    <th className="p-2 text-start">{t("admin.analytics.published")}</th>
                    <th className="p-2 text-start">{t("admin.analytics.new")}</th>
                    <th className="p-2 text-start">{t("admin.analytics.expired")}</th>
                    <th className="p-2 text-start">{t("admin.analytics.views")}</th>
                    <th className="p-2 text-start">{t("admin.analytics.calls")}</th>
                    <th className="p-2 text-start">{t("admin.analytics.conversations")}</th>
                    <th className="p-2 text-start">{t("admin.analytics.reportsOpen")}</th>
                  </tr>
                </thead>
                <tbody>
                  {fieldRows.map((f) => (
                    <tr key={f.category_id} className="border-t border-border">
                      <td className="p-2 text-foreground">
                        {locale === "ar" ? f.name_ar : (f.name_en ?? f.name_ar)}
                      </td>
                      <td className="p-2 tabular-nums">{n(f.listings)}</td>
                      <td className="p-2 tabular-nums">{n(f.new_listings)}</td>
                      <td className="p-2 tabular-nums">{n(f.expired)}</td>
                      <td className="p-2 tabular-nums">{n(f.views)}</td>
                      <td className="p-2 tabular-nums">{n(f.calls)}</td>
                      <td className="p-2 tabular-nums">{n(f.conversations)}</td>
                      <td className="p-2 tabular-nums">{n(f.reports)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>

      <Section title={t("admin.analytics.searchTitle")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label={t("admin.analytics.searches")} value={n(search.data?.searches)} />
          <Tile label={t("admin.analytics.zeroSearches")} value={n(search.data?.zero_result_searches)} />
          <Tile label={t("admin.analytics.searchClicks")} value={n(search.data?.result_clicks)} />
          <Tile
            label={t("admin.analytics.avgSearchMs")}
            value={search.data?.avg_duration_ms == null ? "—" : n(search.data.avg_duration_ms)}
          />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Ranked title={t("admin.analytics.topTerms")} rows={search.data?.top_terms} empty={empty} locale={locale} />
          <Ranked title={t("admin.analytics.zeroTerms")} rows={search.data?.zero_terms} empty={empty} locale={locale} />
          <Ranked title={t("admin.analytics.topCities")} rows={search.data?.top_cities} empty={empty} locale={locale} />
          <Ranked
            title={t("admin.analytics.topCategories")}
            rows={search.data?.top_categories}
            empty={empty}
            locale={locale}
          />
        </div>
      </Section>

      <Section title={t("admin.analytics.listingsTitle")}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Ranked title={t("admin.analytics.mostViewed")} rows={listings.data?.most_viewed} empty={empty} locale={locale} />
          <Ranked title={t("admin.analytics.mostCalled")} rows={listings.data?.most_called} empty={empty} locale={locale} />
          <Ranked
            title={t("admin.analytics.mostMessaged")}
            rows={listings.data?.most_messaged}
            empty={empty}
            locale={locale}
          />
          <Ranked
            title={t("admin.analytics.mostFavorited")}
            rows={listings.data?.most_favorited}
            empty={empty}
            locale={locale}
          />
          <Ranked title={t("admin.analytics.mostShared")} rows={listings.data?.most_shared} empty={empty} locale={locale} />
          <Ranked title={t("admin.analytics.zeroViews")} rows={listings.data?.zero_views} empty={empty} locale={locale} />
          <Ranked title={t("admin.analytics.expired")} rows={listings.data?.expired} empty={empty} locale={locale} />
          <Ranked title={t("admin.analytics.reported")} rows={listings.data?.reported} empty={empty} locale={locale} />
          <Ranked title={t("admin.analytics.featured")} rows={listings.data?.featured} empty={empty} locale={locale} />
        </div>
      </Section>

      <Section title={t("admin.analytics.peopleTitle")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <Tile label={t("admin.analytics.totalUsers")} value={n(people.data?.users.total)} />
          <Tile label={t("admin.analytics.newUsers")} value={n(people.data?.users.new)} />
          <Tile label={t("admin.analytics.activeUsers")} value={n(people.data?.users.active)} />
          <Tile label={t("admin.analytics.inactiveUsers")} value={n(people.data?.users.inactive)} />
          <Tile label={t("admin.analytics.bannedUsers")} value={n(people.data?.users.banned)} />
          <Tile label={t("admin.analytics.deletedUsers")} value={n(people.data?.users.deleted)} />
          <Tile label={t("admin.analytics.businesses")} value={n(people.data?.businesses.total)} />
          <Tile label={t("admin.analytics.newBusinesses")} value={n(people.data?.businesses.new)} />
          <Tile label={t("admin.analytics.verifiedBusinesses")} value={n(people.data?.businesses.verified)} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Ranked
            title={t("admin.analytics.topPublishers")}
            rows={people.data?.users.top_publishers}
            empty={empty}
            locale={locale}
          />
          <Ranked
            title={t("admin.analytics.topMessaged")}
            rows={people.data?.users.top_message_receivers}
            empty={empty}
            locale={locale}
          />
          <Ranked
            title={t("admin.analytics.topCalled")}
            rows={people.data?.users.top_call_receivers}
            empty={empty}
            locale={locale}
          />
          <Ranked
            title={t("admin.analytics.topActiveBusinesses")}
            rows={people.data?.businesses.top_active}
            empty={empty}
            locale={locale}
          />
          <Ranked
            title={t("admin.analytics.topViewedBusinesses")}
            rows={people.data?.businesses.top_viewed}
            empty={empty}
            locale={locale}
          />
          <Ranked
            title={t("admin.analytics.topConversationBusinesses")}
            rows={people.data?.businesses.top_conversations}
            empty={empty}
            locale={locale}
          />
        </div>
      </Section>

      <Section title={t("admin.analytics.healthTitle")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <Tile
            label={t("admin.analytics.avgPageMs")}
            value={health.data?.performance.avg_page_ms == null ? "—" : n(health.data.performance.avg_page_ms)}
          />
          <Tile label={t("admin.analytics.pageViews")} value={n(health.data?.performance.page_views)} />
          <Tile label={t("admin.analytics.realtimeTables")} value={n(health.data?.performance.realtime_tables)} />
          <Tile label={t("admin.analytics.errJs")} value={n(health.data?.errors.js)} />
          <Tile label={t("admin.analytics.errApi")} value={n(health.data?.errors.api)} />
          <Tile label={t("admin.analytics.errImage")} value={n(health.data?.errors.image)} />
          <Tile label={t("admin.analytics.errStorage")} value={n(health.data?.errors.storage)} />
          <Tile label={t("admin.analytics.errDb")} value={n(health.data?.errors.db)} />
          <Tile label={t("admin.analytics.failedLogins")} value={n(health.data?.security.failed_logins)} />
          <Tile label={t("admin.analytics.lockedAccounts")} value={n(health.data?.security.locked_accounts)} />
          <Tile label={t("admin.analytics.bannedUsers")} value={n(health.data?.security.banned_accounts)} />
          <Tile label={t("admin.analytics.unauthorized")} value={n(health.data?.security.unauthorized_attempts)} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Ranked
            title={t("admin.analytics.slowestPages")}
            rows={health.data?.performance.slowest_pages}
            empty={empty}
            locale={locale}
          />
          <Ranked title={t("admin.analytics.topErrors")} rows={health.data?.errors.top} empty={empty} locale={locale} />
        </div>
      </Section>

      <Section title={t("admin.analytics.opsTitle")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {ops.data?.conversations ? (
            <>
              <Tile label={t("admin.analytics.newConversations")} value={n(ops.data.conversations.new)} />
              <Tile label={t("admin.analytics.messages")} value={n(ops.data.conversations.messages)} />
              <Tile label={t("admin.analytics.attachments")} value={n(ops.data.conversations.attachments)} />
              <Tile label={t("admin.analytics.audio")} value={n(ops.data.conversations.audio)} />
              <Tile label={t("admin.analytics.locations")} value={n(ops.data.conversations.locations)} />
              <Tile label={t("admin.analytics.flagged")} value={n(ops.data.conversations.flagged)} />
            </>
          ) : (
            <p className="col-span-full text-xs text-muted-foreground">{t("admin.analytics.noPermission")}</p>
          )}
        </div>
        {ops.data?.verification && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <Tile label={t("admin.analytics.verifPending")} value={n(ops.data.verification.pending)} />
            <Tile label={t("admin.analytics.verifReview")} value={n(ops.data.verification.in_review)} />
            <Tile label={t("admin.analytics.verifApproved")} value={n(ops.data.verification.approved)} />
            <Tile label={t("admin.analytics.verifRejected")} value={n(ops.data.verification.rejected)} />
            <Tile
              label={t("admin.analytics.verifHours")}
              value={ops.data.verification.avg_review_hours == null ? "—" : n(ops.data.verification.avg_review_hours)}
            />
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label={t("admin.analytics.openWork")} value={n(ops.data?.admin.open_work)} />
          <Tile label={t("admin.analytics.closedWork")} value={n(ops.data?.admin.closed_work)} />
          <Tile label={t("admin.analytics.staffRequests")} value={n(ops.data?.admin.staff_requests)} />
          <Tile label={t("admin.analytics.opsToday")} value={n(ops.data?.admin.operations_today)} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Ranked title={t("admin.analytics.topStaff")} rows={ops.data?.admin.top_staff} empty={empty} locale={locale} />
          <Ranked
            title={t("admin.analytics.lightestStaff")}
            rows={ops.data?.admin.lightest_staff}
            empty={empty}
            locale={locale}
          />
        </div>
      </Section>

      <Section title={t("admin.analytics.geoTitle")}>
        {!geo.data || geo.data.length === 0 ? (
          <p className="text-xs text-muted-foreground">{empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">{t("admin.analytics.city")}</th>
                  <th className="p-2 text-start">{t("admin.analytics.published")}</th>
                  <th className="p-2 text-start">{t("admin.analytics.totalUsers")}</th>
                  <th className="p-2 text-start">{t("admin.analytics.businesses")}</th>
                  <th className="p-2 text-start">{t("admin.analytics.events")}</th>
                </tr>
              </thead>
              <tbody>
                {geo.data.map((g) => (
                  <tr key={g.id} className="border-t border-border">
                    <td className="p-2 text-foreground">{locale === "ar" ? g.name_ar : (g.name_en ?? g.name_ar)}</td>
                    <td className="p-2 tabular-nums">{n(g.listings)}</td>
                    <td className="p-2 tabular-nums">{n(g.users)}</td>
                    <td className="p-2 tabular-nums">{n(g.businesses)}</td>
                    <td className="p-2 tabular-nums">{n(g.events)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </AdminShell>
  );
}
