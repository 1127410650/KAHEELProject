/**
 * لوحة الإدارة لخدمة «جيب لي»: اعتماد الكباتن، تفعيل/إطفاء الخدمات المرافقة،
 * ومتابعة آخر الطلبات.
 *
 * حالة الكابتن (`pending → approved / suspended`) تُعدّل من هنا فقط: حامية في
 * قاعدة البيانات تمنع الكابتن من ترقية نفسه، وسياسة الإدارة هي الوحيدة التي
 * تسمح بهذا التعديل.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Loader2, PauseCircle, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/marketplace/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import {
  errandStatusLabel,
  setServiceActive,
  useErrandServices,
  type ErrandRequest,
  type ErrandStatus,
} from "@/lib/mkt-errands";

export const Route = createFileRoute("/admin/errands")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "خدمة جيب لي — لوحة مدير النظام" },
      {
        name: "description",
        content: "اعتماد كباتن «جيب لي»، تفعيل الخدمات المرافقة، ومتابعة الطلبات.",
      },
      { property: "og:title", content: "خدمة جيب لي — لوحة مدير النظام" },
      { property: "og:description", content: "إدارة كباتن وطلبات خدمة جيب لي." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminErrandsPage,
});

interface AdminCaptain {
  id: string;
  display_name: string;
  vehicle: string | null;
  status: "pending" | "approved" | "suspended";
  rating_avg: number;
  rating_count: number;
  jobs_done: number;
  created_at: string;
}

function AdminErrandsPage() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const queryClient = useQueryClient();
  const services = useErrandServices(true);
  const [busy, setBusy] = useState<string | null>(null);

  const captains = useQuery({
    queryKey: ["admin", "errand-captains"],
    queryFn: async (): Promise<AdminCaptain[]> => {
      const { data, error } = await supabase
        .from("mkt_errand_captains")
        .select("id, display_name, vehicle, status, rating_avg, rating_count, jobs_done, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as AdminCaptain[];
    },
  });

  const requests = useQuery({
    queryKey: ["admin", "errand-requests"],
    queryFn: async (): Promise<ErrandRequest[]> => {
      const { data, error } = await supabase
        .from("mkt_errand_requests")
        .select(
          "id, user_id, service_slug, details, photo_path, budget_estimate, currency, " +
            "pickup_label, pickup_details, pickup_lat, pickup_lng, " +
            "dropoff_label, dropoff_details, dropoff_lat, dropoff_lng, " +
            "status, captain_id, accepted_offer_id, delivery_fee, offers_count, " +
            "rating, rating_comment, cancel_reason, accepted_at, delivered_at, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as unknown as ErrandRequest[];
    },
  });

  async function setCaptainStatus(id: string, status: AdminCaptain["status"]) {
    setBusy(id);
    try {
      const { error } = await supabase
        .from("mkt_errand_captains")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      await captains.refetch();
      toast.success(ar ? "تم تحديث حالة الكابتن." : "Captain status updated.");
    } catch {
      toast.error(ar ? "تعذّر التحديث." : "Could not update.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleService(id: string, active: boolean) {
    try {
      await setServiceActive(id, active);
      await queryClient.invalidateQueries({ queryKey: ["mkt", "errand-services"] });
      toast.success(ar ? "تم تحديث الخدمة." : "Service updated.");
    } catch {
      toast.error(ar ? "تعذّر تحديث الخدمة." : "Could not update the service.");
    }
  }

  return (
    <AdminShell title={ar ? "خدمة جيب لي" : "Errands service"}>
      <div className="grid gap-4 pb-16">
        {/* الخدمات */}
        <Card>
          <CardContent className="p-3">
            <h2 className="mb-2 text-sm font-bold text-foreground">
              {ar ? "الخدمات المرافقة" : "Service catalogue"}
            </h2>
            {services.isLoading ? (
              <Skeleton className="h-[120px] rounded-xl" />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {(services.data ?? []).map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-card/50 p-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-bold text-foreground">
                        {ar ? service.name_ar : service.name_en}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">{service.slug}</p>
                    </div>
                    <Switch
                      checked={service.is_active}
                      onCheckedChange={(next) => toggleService(service.id, next)}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* الكباتن */}
        <Card>
          <CardContent className="p-3">
            <h2 className="mb-2 text-sm font-bold text-foreground">
              {ar ? "الكباتن" : "Captains"}
            </h2>
            {captains.isLoading ? (
              <Skeleton className="h-[120px] rounded-xl" />
            ) : (captains.data?.length ?? 0) === 0 ? (
              <p className="p-3 text-center text-[12px] text-muted-foreground">
                {ar ? "ما في كباتن مسجّلين بعد." : "No captains yet."}
              </p>
            ) : (
              <div className="grid gap-2">
                {captains.data!.map((captain) => (
                  <div
                    key={captain.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-card/50 p-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-bold text-foreground">
                        {captain.display_name}
                      </p>
                      <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <Star className="h-3 w-3 text-amber-500" />
                          {formatNumber(captain.rating_avg)} ({captain.rating_count})
                        </span>
                        <span>{captain.vehicle ?? "—"}</span>
                        <span>{formatDateTime(captain.created_at)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={captain.status === "approved" ? "default" : "secondary"}
                        className="text-[10.5px]"
                      >
                        {captain.status === "approved"
                          ? ar
                            ? "معتمد"
                            : "Approved"
                          : captain.status === "pending"
                            ? ar
                              ? "قيد المراجعة"
                              : "Pending"
                            : ar
                              ? "موقوف"
                              : "Suspended"}
                      </Badge>
                      {captain.status !== "approved" ? (
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 gap-1 text-[11px]"
                          disabled={busy === captain.id}
                          onClick={() => setCaptainStatus(captain.id, "approved")}
                        >
                          {busy === captain.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <BadgeCheck className="h-3.5 w-3.5" />
                          )}
                          {ar ? "اعتماد" : "Approve"}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-[11px]"
                          disabled={busy === captain.id}
                          onClick={() => setCaptainStatus(captain.id, "suspended")}
                        >
                          <PauseCircle className="h-3.5 w-3.5" />
                          {ar ? "إيقاف" : "Suspend"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* الطلبات */}
        <Card>
          <CardContent className="p-3">
            <h2 className="mb-2 text-sm font-bold text-foreground">
              {ar ? "آخر الطلبات" : "Latest requests"}
            </h2>
            {requests.isLoading ? (
              <Skeleton className="h-[120px] rounded-xl" />
            ) : (requests.data?.length ?? 0) === 0 ? (
              <p className="p-3 text-center text-[12px] text-muted-foreground">
                {ar ? "ما في طلبات بعد." : "No requests yet."}
              </p>
            ) : (
              <div className="grid gap-2">
                {requests.data!.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-xl border border-border/60 bg-card/50 p-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 min-w-0 text-[12.5px] text-foreground">
                        {request.details}
                      </p>
                      <Badge variant="secondary" className="shrink-0 text-[10.5px]">
                        {errandStatusLabel(request.status as ErrandStatus, ar)}
                      </Badge>
                    </div>
                    <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                      <span>{request.service_slug}</span>
                      <span>{request.dropoff_label}</span>
                      <span>{formatDateTime(request.created_at)}</span>
                      {request.delivery_fee != null ? (
                        <span className="font-bold text-primary">
                          {formatMoney(request.delivery_fee, locale)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
