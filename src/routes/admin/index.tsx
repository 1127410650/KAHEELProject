/**
 * /admin — «استوديو كَحيل»: بوابة بصرية واحدة لكل أدوات الترتيب والرسم.
 * كل بلاطة تفتح شاشة موجودة (لا قدرة معلّقة بلا مدخل)، وكل الألوان من رموز
 * اللوحة المفعّلة.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Brush,
  Images,
  LayoutTemplate,
  Megaphone,
  Palette,
  PenTool,
  Sparkles,
  Clock,
  Inbox,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";

import { useI18n } from "@/i18n";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { AdminCard, AdminPageHead } from "@/components/admin/AdminPage";
import { loadAdminOverview } from "@/lib/mkt-platform";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "استوديو كَحيل — لوحة الإدارة" },
      {
        name: "description",
        content: "استوديو كَحيل: المؤلّف والرسم والأشكال وألوان المنصة والوسائط ووضع التحرير الحي.",
      },
      { property: "og:title", content: "استوديو كَحيل — لوحة الإدارة" },
      { property: "og:description", content: "بوابة الترتيب الكلي والرسم في منصة كَحيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminStudioPage,
});

interface StudioTile {
  to?: string;
  labelKey: string;
  descKey: string;
  icon: LucideIcon;
  onClick?: () => void;
}

const TILES: StudioTile[] = [
  {
    to: "/admin/composer",
    labelKey: "admin.studio.composer",
    descKey: "admin.studio.composerDesc",
    icon: LayoutTemplate,
  },
  {
    to: "/admin/designs",
    labelKey: "admin.studio.shapes",
    descKey: "admin.studio.shapesDesc",
    icon: PenTool,
  },
  {
    to: "/admin/appearance",
    labelKey: "admin.studio.palette",
    descKey: "admin.studio.paletteDesc",
    icon: Palette,
  },
  {
    to: "/admin/appearance/variants",
    labelKey: "admin.studio.media",
    descKey: "admin.studio.mediaDesc",
    icon: Images,
  },
];

function useStudioStats() {
  const overview = useQuery({
    queryKey: ["mkt", "admin", "overview", "studio"],
    queryFn: loadAdminOverview,
  });

  const extras = useQuery({
    queryKey: ["mkt", "admin", "studio", "extras"],
    queryFn: async () => {
      const [campaigns, slot] = await Promise.all([
        supabase
          .from("mkt_ad_campaigns")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true),
        supabase
          .from("mkt_media_slots")
          .select("updated_at")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return {
        activeCampaigns: campaigns.count ?? 0,
        lastAppearanceEdit: (slot.data?.updated_at as string | null) ?? null,
      };
    },
  });

  return { overview, extras };
}

function AdminStudioPage() {
  const { t, locale } = useI18n();
  const { overview, extras } = useStudioStats();

  function openLiveEdit() {
    try {
      sessionStorage.setItem("kaheel.liveEdit", "1");
    } catch {
      /* التخزين غير متاح — الوضع يبقى قابلًا للتفعيل من الواجهة */
    }
    window.location.href = "/?admin_preview=1";
  }

  const stats: { key: string; value: string; icon: LucideIcon; to: string }[] = [
    {
      key: "admin.studio.statListings",
      value: String(overview.data?.listings_published ?? 0),
      icon: Megaphone,
      to: "/admin/listings",
    },
    {
      key: "admin.studio.statRequests",
      value: String(overview.data?.unassigned_requests ?? 0),
      icon: Inbox,
      to: "/admin/reports",
    },
    {
      key: "admin.studio.statCampaigns",
      value: String(extras.data?.activeCampaigns ?? 0),
      icon: Sparkles,
      to: "/admin/campaigns",
    },
    {
      key: "admin.studio.statLastEdit",
      value: extras.data?.lastAppearanceEdit
        ? formatDateTime(extras.data.lastAppearanceEdit, locale)
        : "—",
      icon: Clock,
      to: "/admin/appearance",
    },
  ];

  return (
    <AdminShell title={t("admin.studio.title")}>
      <AdminPageHead title={t("admin.studio.title")} description={t("admin.studio.subtitle")} />

      {/* بطاقة الاستوديو الرئيسية */}
      <section className="k-fade-up relative overflow-hidden rounded-[var(--r-card)] border border-border bg-[linear-gradient(135deg,var(--kt-header-from)_0%,var(--kt-header-to)_100%)] p-[var(--sp-5)] text-[color:var(--kt-cta-bg)] shadow-[0_10px_34px_rgba(0,0,0,0.10)]">
        <span className="k-admin-grain pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-[var(--sp-3)]">
          <div className="min-w-0">
            <p className="text-[14px] font-bold opacity-80">{t("admin.studio.eyebrow")}</p>
            <h1 className="mt-1 text-[20px] font-black leading-tight sm:text-[24px]">
              {t("admin.studio.heroTitle")}
            </h1>
            <p className="mt-[var(--sp-2)] max-w-[52ch] text-[14px] leading-relaxed opacity-85">
              {t("admin.studio.heroDesc")}
            </p>
          </div>
          <span className="grid size-12 shrink-0 place-items-center rounded-[var(--r-card)] bg-[color:var(--kt-cta-bg)]/15">
            <Brush className="size-6" aria-hidden />
          </span>
        </div>
        <div className="relative mt-[var(--sp-4)] flex flex-wrap gap-2">
          <Link
            to="/admin/composer"
            className="k-press inline-flex min-h-11 items-center gap-2 rounded-[var(--r-btn,12px)] bg-[color:var(--kt-cta-bg)] px-4 text-[14px] font-bold text-[color:var(--kt-cta-fg)]"
          >
            <LayoutTemplate className="size-4" aria-hidden />
            {t("admin.studio.openComposer")}
          </Link>
          <button
            type="button"
            onClick={openLiveEdit}
            className="k-press inline-flex min-h-11 items-center gap-2 rounded-[var(--r-btn,12px)] border border-[color:var(--kt-cta-bg)]/45 px-4 text-[14px] font-bold"
          >
            <Sparkles className="size-4" aria-hidden />
            {t("admin.studio.liveEdit")}
          </button>
        </div>
      </section>

      {/* بلاطات الاستوديو */}
      <div className="mt-[var(--sp-4)] grid grid-cols-1 gap-[var(--sp-3)] sm:grid-cols-2 xl:grid-cols-4">
        {TILES.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.labelKey}
              to={tile.to ?? "/admin"}
              className="k-press k-fade-up group flex min-h-[112px] flex-col justify-between rounded-[var(--r-card)] border border-border border-s-[3px] border-s-primary bg-[color-mix(in_srgb,var(--kt-primary)_6%,var(--kt-card))] p-[var(--sp-4)]"
            >
              <span className="grid size-10 place-items-center rounded-[var(--r-chip,12px)] bg-primary/12 text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="mt-[var(--sp-3)] block min-w-0">
                <span className="flex items-center gap-1 text-[16px] font-bold text-foreground">
                  <span className="truncate">{t(tile.labelKey)}</span>
                  <ArrowUpRight className="size-4 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                </span>
                <span className="mt-0.5 block text-[14px] leading-snug text-muted-foreground">
                  {t(tile.descKey)}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      {/* أرقام سريعة */}
      <AdminCard
        className="mt-[var(--sp-4)]"
        title={t("admin.studio.statsTitle")}
        description={t("admin.studio.statsHint")}
      >
        {overview.isLoading ? (
          <div className="grid grid-cols-2 gap-[var(--sp-3)] lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-[var(--r-card)]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-[var(--sp-3)] lg:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Link
                  key={stat.key}
                  to={stat.to}
                  className="k-press min-w-0 rounded-[var(--r-card)] border border-border bg-secondary/40 p-[var(--sp-3)]"
                >
                  <span className="flex items-center gap-2 text-[14px] text-muted-foreground">
                    <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="truncate">{t(stat.key)}</span>
                  </span>
                  <span className="mt-1 block truncate text-[18px] font-black tabular-nums text-foreground">
                    {stat.value}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </AdminCard>
    </AdminShell>
  );
}
