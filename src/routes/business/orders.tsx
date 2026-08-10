import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check, ChefHat, Loader2, PackageCheck, Truck, X } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n";
import { useActiveAccount } from "@/lib/mkt-account";
import {
  joinErrorMessage,
  merchantOrderAction,
  useMerchantOrders,
  useOperationalAccess,
  type MerchantOrder,
} from "@/lib/mkt-provider-onboarding";

type Filter = "all" | "submitted" | "active" | "completed";

export const Route = createFileRoute("/business/orders")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "إدارة الطلبات — كَحيل" },
      { name: "description", content: "قبول وتجهيز وتسليم طلبات المتجر المعتمد." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MerchantOrdersPage,
});

function MerchantOrdersPage() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const { account } = useActiveAccount();
  const accountKey = account?.account_key ?? null;
  const access = useOperationalAccess(accountKey);
  const orders = useMerchantOrders(accountKey, null, access.data?.allowed === true);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const all = orders.data ?? [];
    if (filter === "submitted") return all.filter((row) => row.order_status === "submitted");
    if (filter === "active")
      return all.filter((row) =>
        ["accepted", "preparing", "ready", "out_for_delivery"].includes(row.order_status),
      );
    if (filter === "completed")
      return all.filter((row) => ["completed", "rejected", "cancelled"].includes(row.order_status));
    return all;
  }, [filter, orders.data]);

  async function act(
    order: MerchantOrder,
    action: Parameters<typeof merchantOrderAction>[0]["action"],
  ) {
    if (!accountKey || busyId) return;
    let note: string | undefined;
    if (action === "reject" || action === "cancel") {
      const value = window.prompt(
        locale === "ar"
          ? "اكتب سببًا واضحًا يظهر في سجل الطلب:"
          : "Enter a clear reason for the order history:",
      );
      if (value === null) return;
      if (!value.trim()) {
        toast.error(locale === "ar" ? "السبب مطلوب." : "A reason is required.");
        return;
      }
      note = value.trim();
    }
    setBusyId(order.id);
    try {
      await merchantOrderAction({
        accountKey,
        orderId: order.id,
        action,
        ...(note ? { note } : {}),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mkt", "merchant-orders", accountKey] }),
        queryClient.invalidateQueries({ queryKey: ["mkt", "operations-overview", accountKey] }),
      ]);
      toast.success(locale === "ar" ? "تم تحديث الطلب." : "Order updated.");
    } catch (error) {
      toast.error(joinErrorMessage(error, locale));
    } finally {
      setBusyId(null);
    }
  }

  if (access.isLoading || orders.isLoading) {
    return (
      <DashboardShell title={locale === "ar" ? "إدارة الطلبات" : "Order management"}>
        <Skeleton className="h-80 rounded-3xl" />
      </DashboardShell>
    );
  }

  const canReceiveOrders =
    access.data?.allowed && access.data.capabilities.includes("orders.receive");
  if (!canReceiveOrders) {
    return (
      <DashboardShell title={locale === "ar" ? "إدارة الطلبات" : "Order management"}>
        <Card className="rounded-3xl">
          <CardContent className="space-y-3 p-7 text-center">
            <PackageCheck className="mx-auto size-10 text-primary" />
            <p className="font-black">
              {locale === "ar"
                ? "هذه الأداة مخصصة لحساب بائع مقبول"
                : "This tool requires an approved seller account"}
            </p>
            <Button asChild>
              <Link to="/more">{locale === "ar" ? "العودة إلى الحساب" : "Back to account"}</Link>
            </Button>
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title={locale === "ar" ? "إدارة الطلبات" : "Order management"}>
      <div className="space-y-4">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl p-1.5 sm:w-auto">
            <TabsTrigger value="all">{locale === "ar" ? "الكل" : "All"}</TabsTrigger>
            <TabsTrigger value="submitted">{locale === "ar" ? "جديدة" : "New"}</TabsTrigger>
            <TabsTrigger value="active">{locale === "ar" ? "قيد التنفيذ" : "Active"}</TabsTrigger>
            <TabsTrigger value="completed">{locale === "ar" ? "مغلقة" : "Closed"}</TabsTrigger>
          </TabsList>
        </Tabs>

        {rows.length === 0 ? (
          <Card className="rounded-3xl border-dashed">
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              {locale === "ar" ? "لا توجد طلبات في هذه المرحلة." : "No orders in this stage."}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {rows.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                locale={locale}
                busy={busyId === order.id}
                onAction={(action) => void act(order, action)}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function OrderCard({
  order,
  locale,
  busy,
  onAction,
}: {
  order: MerchantOrder;
  locale: "ar" | "en";
  busy: boolean;
  onAction: (action: Parameters<typeof merchantOrderAction>[0]["action"]) => void;
}) {
  const actions = actionOptions(order.order_status, locale);
  const currency = new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
    style: "currency",
    currency: order.currency_code || "SAR",
    maximumFractionDigits: 2,
  }).format(order.total);
  const created = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Riyadh",
  }).format(new Date(order.created_at));

  return (
    <Card className="rounded-3xl">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-black">{order.order_number}</p>
            <p className="mt-1 text-desc text-muted-foreground">{created}</p>
          </div>
          <Badge variant={order.order_status === "submitted" ? "default" : "secondary"}>
            {statusLabel(order.order_status, locale)}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary/45 p-3 text-desc sm:grid-cols-4">
          <Metric
            label={locale === "ar" ? "العميل" : "Customer"}
            value={order.customer_name || "—"}
          />
          <Metric label={locale === "ar" ? "العناصر" : "Items"} value={String(order.items_count)} />
          <Metric
            label={locale === "ar" ? "الدفع" : "Payment"}
            value={paymentLabel(order.payment_status, locale)}
          />
          <Metric label={locale === "ar" ? "الإجمالي" : "Total"} value={currency} />
        </div>

        {order.delivery_address_text || order.delivery_district ? (
          <p className="text-desc leading-6 text-muted-foreground">
            <Truck className="me-1 inline size-4" />
            {[order.delivery_district, order.delivery_address_text].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        {order.customer_notes ? (
          <p className="rounded-xl border p-3 text-desc leading-6">{order.customer_notes}</p>
        ) : null}

        {actions.length ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action.action}
                size="sm"
                variant={action.variant}
                disabled={busy}
                onClick={() => onAction(action.action)}
              >
                {busy ? (
                  <Loader2 className="me-1 size-4 animate-spin" />
                ) : (
                  <action.icon className="me-1 size-4" />
                )}
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-desc text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-bold">{value}</p>
    </div>
  );
}

function statusLabel(status: MerchantOrder["order_status"], locale: "ar" | "en") {
  const ar: Record<MerchantOrder["order_status"], string> = {
    submitted: "طلب جديد",
    accepted: "مقبول",
    preparing: "قيد التجهيز",
    ready: "جاهز",
    out_for_delivery: "خرج للتوصيل",
    completed: "مكتمل",
    rejected: "مرفوض",
    cancelled: "ملغي",
  };
  const en: Record<MerchantOrder["order_status"], string> = {
    submitted: "New",
    accepted: "Accepted",
    preparing: "Preparing",
    ready: "Ready",
    out_for_delivery: "Out for delivery",
    completed: "Completed",
    rejected: "Rejected",
    cancelled: "Cancelled",
  };
  return (locale === "ar" ? ar : en)[status];
}

function paymentLabel(status: string, locale: "ar" | "en") {
  const labels: Record<string, [string, string]> = {
    unpaid: ["غير مدفوع", "Unpaid"],
    pending: ["بانتظار التحقق", "Pending"],
    paid: ["مدفوع", "Paid"],
    refunded: ["مسترد", "Refunded"],
    failed: ["فشل", "Failed"],
  };
  return labels[status]?.[locale === "ar" ? 0 : 1] ?? status;
}

function actionOptions(status: MerchantOrder["order_status"], locale: "ar" | "en") {
  const text = (ar: string, en: string) => (locale === "ar" ? ar : en);
  if (status === "submitted")
    return [
      {
        action: "accept" as const,
        label: text("قبول الطلب", "Accept"),
        icon: Check,
        variant: "default" as const,
      },
      {
        action: "reject" as const,
        label: text("رفض", "Reject"),
        icon: X,
        variant: "outline" as const,
      },
    ];
  if (status === "accepted")
    return [
      {
        action: "prepare" as const,
        label: text("بدء التجهيز", "Start preparing"),
        icon: ChefHat,
        variant: "default" as const,
      },
      {
        action: "cancel" as const,
        label: text("إلغاء", "Cancel"),
        icon: X,
        variant: "outline" as const,
      },
    ];
  if (status === "preparing")
    return [
      {
        action: "ready" as const,
        label: text("الطلب جاهز", "Mark ready"),
        icon: PackageCheck,
        variant: "default" as const,
      },
      {
        action: "cancel" as const,
        label: text("إلغاء", "Cancel"),
        icon: X,
        variant: "outline" as const,
      },
    ];
  if (status === "ready")
    return [
      {
        action: "dispatch" as const,
        label: text("خرج للتوصيل", "Dispatch"),
        icon: Truck,
        variant: "default" as const,
      },
      {
        action: "complete" as const,
        label: text("تم التسليم", "Complete"),
        icon: Check,
        variant: "secondary" as const,
      },
      {
        action: "cancel" as const,
        label: text("إلغاء", "Cancel"),
        icon: X,
        variant: "outline" as const,
      },
    ];
  if (status === "out_for_delivery")
    return [
      {
        action: "complete" as const,
        label: text("تم التسليم", "Complete"),
        icon: Check,
        variant: "default" as const,
      },
    ];
  return [];
}
