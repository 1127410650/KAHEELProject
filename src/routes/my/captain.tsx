/**
 * مساحة الكابتن — التسجيل، التواجد، الطلبات المفتوحة، تقديم العروض، وتقدّم التنفيذ.
 *
 * الضوابط:
 *  • التسجيل يُنشئ ملفًا بحالة «قيد المراجعة»؛ الاعتماد من لوحة الإدارة حصرًا
 *    (حامية في قاعدة البيانات تمنع الكابتن من ترقية نفسه).
 *  • تقديم العرض وتقدّم التنفيذ يمرّان بعمليات مؤمّنة على الخادم، فلا يستطيع
 *    كابتن غير معتمد أو غير مكلّف تحريك أي طلب.
 *  • الطلبات المفتوحة تُعرض بوصفها ومنطقتها فقط — بلا رقم هاتف، والرقم يظهر
 *    بعد قبول العميل للعرض.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BadgeCheck, Loader2, MapPin, Send, Star, TruckIcon } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import {
  advanceErrand,
  applyAsCaptain,
  errandStatusLabel,
  nextCaptainStatus,
  placeErrandOffer,
  setCaptainOnline,
  useCaptainQueue,
  useInvalidateErrand,
  useMyCaptain,
  type ErrandRequest,
} from "@/lib/mkt-errands";

export const Route = createFileRoute("/my/captain")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "مساحة الكابتن — كَحيل" },
      {
        name: "description",
        content: "مساحة كابتن كَحيل: الطلبات المفتوحة، تقديم عرض السعر، ومتابعة التوصيل حتى التسليم.",
      },
      { property: "og:title", content: "مساحة الكابتن — كَحيل" },
      { property: "og:description", content: "استلم طلبات «جيب لي» وقدّم عرضك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CaptainPage,
});

function CaptainPage() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { session } = useSession();
  const captainQuery = useMyCaptain(session?.user.id ?? null);
  const captain = captainQuery.data ?? null;
  const queue = useCaptainQueue(captain);
  const invalidate = useInvalidateErrand();

  const [form, setForm] = useState({ displayName: "", phone: "", vehicle: "" });
  const [saving, setSaving] = useState(false);
  const [offerFor, setOfferFor] = useState<string | null>(null);
  const [offer, setOffer] = useState({ fee: "", eta: "", note: "" });
  const [busy, setBusy] = useState<string | null>(null);

  const title = ar ? "مساحة الكابتن" : "Captain workspace";

  async function apply(event: React.FormEvent) {
    event.preventDefault();
    if (form.displayName.trim().length < 3) {
      toast.error(ar ? "اكتب اسمك كما يظهر للعميل." : "Enter the name clients will see.");
      return;
    }
    setSaving(true);
    try {
      await applyAsCaptain(form);
      await captainQuery.refetch();
      toast.success(ar ? "تم إرسال طلب التسجيل للمراجعة." : "Application sent for review.");
    } catch {
      toast.error(ar ? "تعذّر إرسال الطلب." : "Could not send the application.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleOnline(next: boolean) {
    if (!captain) return;
    try {
      await setCaptainOnline(captain.id, next);
      await captainQuery.refetch();
    } catch {
      toast.error(ar ? "تعذّر تحديث حالة التواجد." : "Could not update availability.");
    }
  }

  async function submitOffer(requestId: string) {
    const fee = Number(offer.fee);
    if (!Number.isFinite(fee) || fee <= 0) {
      toast.error(ar ? "اكتب سعر توصيل صحيح." : "Enter a valid delivery fee.");
      return;
    }
    setBusy(requestId);
    try {
      await placeErrandOffer({
        requestId,
        fee,
        etaMinutes: offer.eta ? Number(offer.eta) : null,
        note: offer.note.trim() || null,
      });
      setOfferFor(null);
      setOffer({ fee: "", eta: "", note: "" });
      invalidate(requestId);
      await queue.refetch();
      toast.success(ar ? "تم إرسال عرضك للعميل." : "Offer sent to the client.");
    } catch {
      toast.error(ar ? "تعذّر إرسال العرض — تأكد أنك معتمد." : "Could not send the offer.");
    } finally {
      setBusy(null);
    }
  }

  async function advance(request: ErrandRequest) {
    const next = nextCaptainStatus(request.status);
    if (!next) return;
    setBusy(request.id);
    try {
      await advanceErrand(request.id, next);
      invalidate(request.id);
      await queue.refetch();
      toast.success(ar ? "تم تحديث حالة الطلب." : "Status updated.");
    } catch {
      toast.error(ar ? "تعذّر تحديث الحالة." : "Could not update the status.");
    } finally {
      setBusy(null);
    }
  }

  if (!session) {
    return (
      <DashboardShell title={title}>
        <p className="mx-auto max-w-md px-3 pt-6 text-center text-desc text-muted-foreground">
          {ar ? "سجّل دخولك أولًا." : "Sign in first."}
        </p>
      </DashboardShell>
    );
  }

  if (captainQuery.isLoading) {
    return (
      <DashboardShell title={title}>
        <div className="mx-auto w-full max-w-2xl px-3 pt-3">
          <Skeleton className="h-[180px] rounded-2xl" />
        </div>
      </DashboardShell>
    );
  }

  // لا ملف كابتن بعد ⇒ نموذج التسجيل
  if (!captain) {
    return (
      <DashboardShell title={title}>
        <form onSubmit={apply} className="mx-auto grid w-full max-w-md gap-2 px-3 pb-24 pt-3">
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-3 text-desc text-foreground">
            {ar
              ? "سجّل كابتن وجيب طلبات الناس. بعد اعتماد الإدارة تشوف الطلبات المفتوحة وتقدّم عرضك."
              : "Register as a captain. After approval you can see open requests and send offers."}
          </div>
          <div className="grid gap-1">
            <Label className="text-desc text-muted-foreground">
              {ar ? "الاسم الظاهر للعميل" : "Name clients will see"}
            </Label>
            <Input
              value={form.displayName}
              maxLength={60}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              className="h-9 text-sm"
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-desc text-muted-foreground">
              {ar ? "رقم الجوال" : "Mobile number"}
            </Label>
            <Input
              value={form.phone}
              maxLength={24}
              inputMode="tel"
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              className="h-9 text-sm"
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-desc text-muted-foreground">
              {ar ? "المركبة" : "Vehicle"}
            </Label>
            <Input
              value={form.vehicle}
              maxLength={60}
              placeholder={ar ? "دراجة نارية / سيارة / سيرًا" : "Motorbike / car / on foot"}
              onChange={(event) => setForm({ ...form, vehicle: event.target.value })}
              className="h-9 text-sm"
            />
          </div>
          <Button type="submit" disabled={saving} className="mt-1 h-10 gap-2 text-sm font-bold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {ar ? "إرسال طلب التسجيل" : "Send application"}
          </Button>
        </form>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title={title}>
      <div className="mx-auto w-full max-w-2xl px-3 pb-24 pt-3">
        {/* بطاقة الكابتن */}
        <section className="mb-3 rounded-2xl border border-border/70 bg-card/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-desc font-black text-foreground">
                {captain.display_name}
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-desc text-muted-foreground">
                <span className="flex items-center gap-0.5">
                  <Star className="h-3 w-3 text-gold-dark" />
                  {formatNumber(captain.rating_avg)} ({captain.rating_count})
                </span>
                <span>
                  {ar ? "طلبات منفّذة" : "Jobs"}: {captain.jobs_done}
                </span>
              </p>
            </div>
            <Badge
              variant={captain.status === "approved" ? "default" : "secondary"}
              className="shrink-0 gap-1 text-desc"
            >
              <BadgeCheck className="h-3 w-3" />
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
          </div>

          {captain.status === "approved" ? (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2">
              <span className="text-desc font-semibold text-foreground">
                {ar ? "متاح لاستلام الطلبات" : "Available for requests"}
              </span>
              <Switch checked={captain.is_online} onCheckedChange={toggleOnline} />
            </div>
          ) : (
            <p className="mt-2 text-desc text-muted-foreground">
              {ar
                ? "بانتظار اعتماد الإدارة — ما تقدر تقدّم عروض قبل الاعتماد."
                : "Waiting for approval before you can send offers."}
            </p>
          )}
        </section>

        {captain.status === "approved" ? (
          <>
            {/* طلباتي المكلّف بها */}
            <section className="mb-3">
              <h2 className="text-section mb-2 font-bold text-foreground">
                {ar ? "طلباتي الجارية" : "My active jobs"}
              </h2>
              {(queue.data?.mine ?? []).filter((request) =>
                ["accepted", "purchasing", "delivering"].includes(request.status),
              ).length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-4 text-center text-desc text-muted-foreground">
                  {ar ? "ما عندك طلب جاري." : "No active job."}
                </p>
              ) : (
                <div className="grid gap-2">
                  {queue
                    .data!.mine.filter((request) =>
                      ["accepted", "purchasing", "delivering"].includes(request.status),
                    )
                    .map((request) => (
                      <div
                        key={request.id}
                        className="rounded-2xl border border-primary/30 bg-primary/5 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 min-w-0 text-desc font-semibold text-foreground">
                            {request.details}
                          </p>
                          <Badge variant="secondary" className="shrink-0 text-desc">
                            {errandStatusLabel(request.status, ar)}
                          </Badge>
                        </div>
                        <p className="mt-1 flex items-center gap-1 text-desc text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          {request.dropoff_label}
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          className="mt-2 h-9 gap-1 text-desc font-bold"
                          disabled={busy === request.id}
                          onClick={() => advance(request)}
                        >
                          {busy === request.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <TruckIcon className="h-4 w-4" />
                          )}
                          {request.status === "accepted"
                            ? ar
                              ? "بلّشت أجيب الطلب"
                              : "Started fetching"
                            : request.status === "purchasing"
                              ? ar
                                ? "على الطريق"
                                : "On the way"
                              : ar
                                ? "تم التسليم"
                                : "Delivered"}
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </section>

            {/* الطلبات المفتوحة */}
            <section>
              <h2 className="text-section mb-2 font-bold text-foreground">
                {ar ? "طلبات مفتوحة" : "Open requests"}
              </h2>
              {queue.isLoading ? (
                <Skeleton className="h-[96px] rounded-2xl" />
              ) : (queue.data?.open.length ?? 0) === 0 ? (
                <p className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-4 text-center text-desc text-muted-foreground">
                  {ar ? "ما في طلبات مفتوحة الآن." : "No open requests right now."}
                </p>
              ) : (
                <div className="grid gap-2">
                  {queue.data!.open.map((request) => (
                    <div
                      key={request.id}
                      className="rounded-2xl border border-border/70 bg-card/60 p-3"
                    >
                      <p className="line-clamp-3 text-desc leading-snug text-foreground">
                        {request.details}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-desc text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {request.dropoff_label}
                        </span>
                        <span>{formatDateTime(request.created_at)}</span>
                        {request.budget_estimate != null ? (
                          <span>
                            {ar ? "ميزانية" : "Budget"}{" "}
                            {formatMoney(request.budget_estimate, locale)}
                          </span>
                        ) : null}
                      </div>

                      {offerFor === request.id ? (
                        <div className="mt-2 grid gap-2 rounded-xl border border-primary/30 bg-primary/5 p-2">
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              value={offer.fee}
                              onChange={(event) =>
                                setOffer({
                                  ...offer,
                                  fee: event.target.value.replace(/[^\d.]/g, ""),
                                })
                              }
                              inputMode="decimal"
                              placeholder={ar ? "سعر التوصيل" : "Delivery fee"}
                              className="h-9 text-sm"
                            />
                            <Input
                              value={offer.eta}
                              onChange={(event) =>
                                setOffer({ ...offer, eta: event.target.value.replace(/\D/g, "") })
                              }
                              inputMode="numeric"
                              placeholder={ar ? "الوقت بالدقائق" : "ETA minutes"}
                              className="h-9 text-sm"
                            />
                          </div>
                          <Input
                            value={offer.note}
                            maxLength={200}
                            onChange={(event) => setOffer({ ...offer, note: event.target.value })}
                            placeholder={ar ? "ملاحظة للعميل (اختياري)" : "Note (optional)"}
                            className="h-9 text-sm"
                          />
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="h-9 flex-1 text-desc font-bold"
                              disabled={busy === request.id}
                              onClick={() => submitOffer(request.id)}
                            >
                              {busy === request.id ? (
                                <Loader2 className="me-1 h-4 w-4 animate-spin" />
                              ) : null}
                              {ar ? "إرسال العرض" : "Send offer"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-9 text-desc"
                              onClick={() => setOfferFor(null)}
                            >
                              {ar ? "إلغاء" : "Cancel"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-2 h-9 text-desc font-bold"
                          onClick={() => {
                            setOfferFor(request.id);
                            setOffer({ fee: "", eta: "", note: "" });
                          }}
                        >
                          {ar ? "قدّم عرض سعر" : "Send an offer"}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </DashboardShell>
  );
}
