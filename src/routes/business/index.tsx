import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Boxes,
  CalendarClock,
  ChartNoAxesCombined,
  CircleDollarSign,
  Megaphone,
  Network,
  PackageCheck,
  Settings2,
  Store,
} from "lucide-react";

import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { useActiveAccount } from "@/lib/mkt-account";
import { useOperationsOverview } from "@/lib/mkt-provider-onboarding";

export const Route = createFileRoute("/business/")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "مركز التشغيل — كَحيل" },
      {
        name: "description",
        content: "إدارة الطلبات والمواعيد والكتالوج والتسويق والترويج من حساب العمل المعتمد.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProviderOperationsPage,
});

function ProviderOperationsPage() {
  const { locale } = useI18n();
  const { account } = useActiveAccount();
  const overview = useOperationsOverview(account?.account_key ?? null);

  if (overview.isLoading) {
    return (
      <DashboardShell title={locale === "ar" ? "مركز التشغيل" : "Operations center"}>
        <div className="space-y-3">
          <Skeleton className="h-44 rounded-[var(--r-card)]" />
          <Skeleton className="h-56 rounded-[var(--r-card)]" />
        </div>
      </DashboardShell>
    );
  }

  if (!overview.data || overview.isError || !overview.data.allowed) {
    return (
      <DashboardShell title={locale === "ar" ? "مركز التشغيل" : "Operations center"}>
        <Card className="mx-auto max-w-2xl rounded-[var(--r-card)]">
          <CardContent className="space-y-4 p-6 text-center sm:p-8">
            <Store className="mx-auto size-11 text-primary" />
            <h2 className="text-section font-black">
              {locale === "ar" ? "المركز متاح بعد قبول طلب الانضمام" : "Available after approval"}
            </h2>
            <p className="text-sm leading-7 text-muted-foreground">
              {locale === "ar"
                ? "لا يكفي إنشاء بيانات المتجر. تراجع إدارة كَحيل الطلب أولًا، ثم يُفعّل حساب العمل وصلاحياته تلقائيًا."
                : "Creating store details does not grant access. Kaheel reviews the application first, then activates the work account and its permissions."}
            </p>
            <Button asChild>
              <Link to="/more">
                {locale === "ar" ? "متابعة طلب الانضمام" : "View join request"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  const data = overview.data;
  const has = (capability: string) => data.capabilities.includes(capability as never);
  const modules = [
    has("orders.receive")
      ? {
          key: "orders",
          to: "/business/orders",
          icon: PackageCheck,
          title: locale === "ar" ? "الطلبات" : "Orders",
          hint:
            locale === "ar"
              ? "قبول الطلب وتجهيزه وتسليمه مع سجل الحالة."
              : "Accept, prepare and fulfill orders with a status trail.",
        }
      : null,
    has("bookings.receive")
      ? {
          key: "appointments",
          to: "/business/services",
          icon: CalendarClock,
          title: locale === "ar" ? "المواعيد والخدمات" : "Appointments & services",
          hint:
            locale === "ar"
              ? "إدارة الحجوزات والتأكيد والتنفيذ والمواعيد القادمة."
              : "Manage booking requests, confirmations and upcoming appointments.",
        }
      : null,
    has("catalog.products") || has("catalog.services")
      ? {
          key: "catalog",
          to: "/business/store/catalog",
          icon: Boxes,
          title: locale === "ar" ? "المنتجات والخدمات" : "Products & services",
          hint:
            locale === "ar"
              ? "كتالوج موحد بالأسعار والتوفر والأقسام."
              : "A unified catalog with pricing, availability and sections.",
        }
      : null,
    has("listings.publish")
      ? {
          key: "marketing",
          to: "/my/ads",
          icon: Megaphone,
          title: locale === "ar" ? "التسويق والإعلانات" : "Marketing & listings",
          hint:
            locale === "ar"
              ? "انشر الإعلانات واربطها بالمتجر وتابع حالتها."
              : "Publish listings, connect them to the store and track status.",
        }
      : null,
    has("listings.publish")
      ? {
          key: "promotion",
          to: "/my/ads",
          icon: ChartNoAxesCombined,
          title: locale === "ar" ? "الترويج المدفوع" : "Paid promotion",
          hint:
            locale === "ar"
              ? "موّل إعلانًا بالنقاط وتابع مدة الترويج الفعالة."
              : "Promote a listing with points and track its active duration.",
        }
      : null,
    has("relationships.manage") || has("integrations.manage")
      ? {
          key: "network",
          to: "/business/partners",
          icon: Network,
          title: locale === "ar" ? "الشركاء والتكامل" : "Partners & integrations",
          hint:
            locale === "ar"
              ? "ربط الموردين والناقلين وأدوات التكامل المصرح بها."
              : "Connect approved suppliers, carriers and integrations.",
        }
      : null,
    {
      key: "settings",
      to: "/business/profile",
      icon: Settings2,
      title: locale === "ar" ? "إعدادات حساب العمل" : "Work account settings",
      hint:
        locale === "ar"
          ? "بيانات المنشأة والأعضاء والهوية العامة."
          : "Business details, members and public identity.",
    },
  ].filter(Boolean) as Array<{
    key: string;
    to: string;
    icon: typeof Store;
    title: string;
    hint: string;
  }>;

  const stats = [
    [locale === "ar" ? "طلبات جديدة" : "New orders", data.orders_pending],
    [locale === "ar" ? "طلبات نشطة" : "Active orders", data.orders_active],
    [locale === "ar" ? "مواعيد اليوم" : "Today's bookings", data.bookings_today],
    [locale === "ar" ? "ترويج فعّال" : "Active promotions", data.active_promotions],
  ];

  return (
    <DashboardShell title={locale === "ar" ? "مركز التشغيل" : "Operations center"}>
      <div className="space-y-5">
        <Card className="overflow-hidden rounded-[var(--r-card)] border-0 bg-gradient-to-br from-market-navy via-primary-pressed to-primary-deep text-white shadow-xl">
          <CardContent className="space-y-5 p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-white/15 text-white hover:bg-white/15">
                    {data.operational_kind === "service_provider"
                      ? locale === "ar"
                        ? "مقدم خدمة"
                        : "Service provider"
                      : locale === "ar"
                        ? "بائع"
                        : "Seller"}
                  </Badge>
                  <Badge className="bg-success/25 text-primary-foreground hover:bg-success/25">
                    {locale === "ar" ? "معتمد تشغيليًا" : "Operationally approved"}
                  </Badge>
                </div>
                <h1 className="text-page mt-3 font-black sm:text-3xl">
                  {locale === "ar" ? "كل أعمالك من مكان واحد" : "Run everything from one place"}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-white/70">
                  {locale === "ar"
                    ? "الطلبات والمواعيد والكتالوج والتسويق والترويج تظهر بحسب نوع حسابك المقبول فقط."
                    : "Orders, bookings, catalog, marketing and promotion appear only when granted to the approved account type."}
                </p>
              </div>
              <CircleDollarSign className="size-10 text-primary-foreground/75" aria-hidden />
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {stats.map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-[var(--r-card)] border border-white/10 bg-white/10 p-3 backdrop-blur"
                >
                  <p className="text-desc text-white/60">{label}</p>
                  <p className="mt-1 text-xl font-black tabular-nums">{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => (
            <Link
              key={module.key}
              to={module.to}
              className="group rounded-[var(--r-card)] border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
            >
              <span className="grid size-11 place-items-center rounded-[var(--r-card)] bg-primary/10 text-primary">
                <module.icon className="size-5" aria-hidden />
              </span>
              <h2 className="mt-4 font-black text-foreground group-hover:text-primary">
                {module.title}
              </h2>
              <p className="mt-1.5 text-desc leading-6 text-muted-foreground">{module.hint}</p>
            </Link>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
