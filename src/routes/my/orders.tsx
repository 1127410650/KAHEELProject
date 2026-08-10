import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bike, CalendarCheck2, ShoppingBag } from "lucide-react";

import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { formatDateTime, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/my/orders")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "طلباتي — كَحيل" },
      {
        name: "description",
        content: "متابعة مشترياتك وطلبات «جيب لي» وحجوزات الخدمات وحالة كل طلب.",
      },
      { property: "og:title", content: "طلباتي — كَحيل" },
      { property: "og:description", content: "Track your Kaheel purchases, errands and bookings." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyOrdersPage,
});

type Kind = "purchase" | "errand" | "booking";

interface UnifiedOrder {
  id: string;
  kind: Kind;
  reference: string;
  status: string;
  created_at: string;
  total: number | null;
  currency: string | null;
  href: string | null;
  /** Closed/terminal states are grouped under «منتهية». */
  closed: boolean;
}

const CLOSED_STATUSES = new Set([
  "completed",
  "delivered",
  "cancelled",
  "canceled",
  "rejected",
  "refunded",
  "expired",
  "no_show",
  "cancelled_by_customer",
  "cancelled_by_provider",
]);

function isClosed(status: string): boolean {
  return CLOSED_STATUSES.has(status);
}

/** Human status label; unknown codes fall back to the raw code, never to blank. */
function statusLabel(status: string, locale: "ar" | "en"): string {
  const ar: Record<string, string> = {
    draft: "مسودة",
    pending: "بانتظار التأكيد",
    submitted: "أُرسل",
    accepted: "مقبول",
    confirmed: "مؤكد",
    preparing: "قيد التحضير",
    en_route: "في الطريق",
    in_progress: "جارٍ التنفيذ",
    out_for_delivery: "قيد التوصيل",
    delivered: "تم التسليم",
    completed: "مكتمل",
    cancelled: "ملغى",
    canceled: "ملغى",
    cancelled_by_customer: "ألغيته",
    cancelled_by_provider: "ألغاه المزوّد",
    rejected: "مرفوض",
    open: "مفتوح",
    offered: "وردت عروض",
    no_show: "لم يحضر",
    expired: "منتهي",
  };
  const en: Record<string, string> = {
    draft: "Draft",
    pending: "Awaiting confirmation",
    submitted: "Submitted",
    accepted: "Accepted",
    confirmed: "Confirmed",
    preparing: "Preparing",
    en_route: "On the way",
    in_progress: "In progress",
    out_for_delivery: "Out for delivery",
    delivered: "Delivered",
    completed: "Completed",
    cancelled: "Cancelled",
    canceled: "Cancelled",
    cancelled_by_customer: "Cancelled by you",
    cancelled_by_provider: "Cancelled by provider",
    rejected: "Rejected",
    open: "Open",
    offered: "Offers received",
    no_show: "No show",
    expired: "Expired",
  };
  return (locale === "ar" ? ar[status] : en[status]) ?? status;
}

function KindIcon({ kind }: { kind: Kind }) {
  if (kind === "errand") return <Bike className="size-4" aria-hidden />;
  if (kind === "booking") return <CalendarCheck2 className="size-4" aria-hidden />;
  return <ShoppingBag className="size-4" aria-hidden />;
}

function MyOrdersPage() {
  const { t, locale } = useI18n();
  const { session } = useSession();
  const [kind, setKind] = useState<"all" | Kind>("all");
  const [phase, setPhase] = useState<"all" | "open" | "done">("all");

  const query = useQuery({
    queryKey: ["mkt", "my-orders", session?.user.id ?? null],
    enabled: !!session,
    queryFn: async (): Promise<UnifiedOrder[]> => {
      const userId = session!.user.id;
      const [purchases, errands, bookings] = await Promise.all([
        supabase
          .from("mkt_orders")
          .select("id, order_number, order_status, total, currency_code, created_at")
          .eq("customer_user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("mkt_errand_requests")
          .select("id, status, delivery_fee, currency, created_at, service_slug")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("mkt_service_bookings")
          .select("id, booking_number, status, total, currency_code, created_at")
          .eq("customer_user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      const rows: UnifiedOrder[] = [];
      for (const row of purchases.data ?? []) {
        rows.push({
          id: row.id,
          kind: "purchase",
          reference: row.order_number ?? row.id.slice(0, 8),
          status: row.order_status ?? "pending",
          created_at: row.created_at,
          total: row.total === null ? null : Number(row.total),
          currency: row.currency_code ?? null,
          href: null,
          closed: isClosed(row.order_status ?? ""),
        });
      }
      for (const row of errands.data ?? []) {
        rows.push({
          id: row.id,
          kind: "errand",
          reference: row.service_slug ?? row.id.slice(0, 8),
          status: row.status ?? "open",
          created_at: row.created_at,
          total: row.delivery_fee === null ? null : Number(row.delivery_fee),
          currency: row.currency ?? null,
          href: `/my/errands/${row.id}`,
          closed: isClosed(row.status ?? ""),
        });
      }
      for (const row of bookings.data ?? []) {
        rows.push({
          id: row.id,
          kind: "booking",
          reference: row.booking_number ?? row.id.slice(0, 8),
          status: row.status ?? "pending",
          created_at: row.created_at,
          total: row.total === null ? null : Number(row.total),
          currency: row.currency_code ?? null,
          href: "/my/bookings",
          closed: isClosed(row.status ?? ""),
        });
      }
      return rows.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    },
  });

  const visible = useMemo(() => {
    const rows = query.data ?? [];
    return rows.filter(
      (row) =>
        (kind === "all" || row.kind === kind) &&
        (phase === "all" || (phase === "open" ? !row.closed : row.closed)),
    );
  }, [query.data, kind, phase]);

  return (
    <DashboardShell title={t("market.myOrders.title")}>
      <p className="text-sm text-muted-foreground">{t("market.myOrders.subtitle")}</p>

      <Tabs value={kind} onValueChange={(value) => setKind(value as typeof kind)} className="mt-4">
        <TabsList className="flex w-full flex-wrap">
          <TabsTrigger value="all">{t("market.myOrders.all")}</TabsTrigger>
          <TabsTrigger value="purchase">{t("market.myOrders.purchases")}</TabsTrigger>
          <TabsTrigger value="errand">{t("market.myOrders.errands")}</TabsTrigger>
          <TabsTrigger value="booking">{t("market.myOrders.bookings")}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-desc font-semibold text-muted-foreground">
          {t("market.myOrders.statusFilter")}
        </span>
        {(["all", "open", "done"] as const).map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={phase === value ? "default" : "outline"}
            onClick={() => setPhase(value)}
          >
            {value === "all"
              ? t("market.myOrders.statusAll")
              : value === "open"
                ? t("market.myOrders.open")
                : t("market.myOrders.done")}
          </Button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {query.isLoading &&
          [0, 1, 2].map((key) => <Skeleton key={key} className="h-24 w-full rounded-2xl" />)}

        {!query.isLoading && visible.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="font-semibold text-foreground">{t("market.myOrders.empty")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("market.myOrders.emptyHint")}
              </p>
              <Button asChild className="mt-4">
                <Link to="/">{t("market.bottomNav.home")}</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {visible.map((row) => (
          <Card key={`${row.kind}-${row.id}`}>
            <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-4">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-secondary text-foreground">
                    <KindIcon kind={row.kind} />
                  </span>
                  <span className="truncate text-sm font-bold text-foreground">
                    {t(`market.myOrders.kind.${row.kind}`)} · <span className="num">{row.reference}</span>
                  </span>
                </div>
                <p className="num mt-1 text-desc text-muted-foreground">
                  {formatDateTime(row.created_at)}
                </p>
                {row.total !== null && row.total > 0 && (
                  <p className="num mt-1 text-sm font-semibold text-foreground">
                    {formatMoney(row.total, locale)}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Badge variant={row.closed ? "secondary" : "default"}>
                  {statusLabel(row.status, locale)}
                </Badge>
                {row.href && (
                  <Button asChild size="sm" variant="outline">
                    <Link to={row.href}>{t("market.myOrders.openDetails")}</Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardShell>
  );
}
