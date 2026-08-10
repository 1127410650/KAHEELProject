/**
 * صفحة طلب «جيب لي» الواحد — العروض والتتبّع والتقييم.
 *
 * • **العروض**: كل عرض يظهر باسم الكابتن وتقييمه وسعره ومدته المتوقعة. القبول
 *   والرفض يمرّان بعملية مؤمّنة على الخادم (`mkt_errand_decide_offer`) تُقفل
 *   بقية العروض تلقائيًا، فلا يمكن قبول عرضين لنفس الطلب.
 * • **الرقم**: يظهر رقم الكابتن **بعد القبول فقط** عبر `mkt_errand_contact`،
 *   ولا يُقرأ من أي جدول مباشرة.
 * • **التتبّع**: خط زمني من الحالات المسجّلة في `mkt_errand_events`.
 * • **التقييم**: متاح بعد التسليم، ويحدّث متوسط تقييم الكابتن على الخادم.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Loader2, MapPin, Phone, Star, XCircle } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import {
  ERRAND_FLOW,
  cancelErrand,
  decideErrandOffer,
  errandStatusLabel,
  rateErrand,
  useErrand,
  useErrandCaptainCards,
  useErrandContact,
  useErrandEvents,
  useErrandOffers,
  useInvalidateErrand,
  type ErrandStatus,
} from "@/lib/mkt-errands";

export const Route = createFileRoute("/my/errands/$id")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "تتبّع طلب جيب لي — كَحيل" },
      {
        name: "description",
        content: "تتبّع طلب «جيب لي»: عروض الكباتن، قبول العرض، مراحل التنفيذ، والتقييم.",
      },
      { property: "og:title", content: "تتبّع طلب جيب لي — كَحيل" },
      { property: "og:description", content: "حالة طلبك لحظة بلحظة حتى التسليم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ErrandDetailPage,
});

function ErrandDetailPage() {
  const { id } = Route.useParams();
  const { locale } = useI18n();
  const ar = locale === "ar";
  const invalidate = useInvalidateErrand();

  const errand = useErrand(id);
  const offers = useErrandOffers(id);
  const events = useErrandEvents(id);
  const captains = useErrandCaptainCards((offers.data ?? []).map((offer) => offer.captain_id));
  const accepted =
    !!errand.data &&
    ["accepted", "purchasing", "delivering", "delivered"].includes(errand.data.status);
  const contact = useErrandContact(id, accepted);

  const [busy, setBusy] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  async function decide(offerId: string, accept: boolean) {
    setBusy(offerId);
    try {
      await decideErrandOffer(offerId, accept);
      invalidate(id);
      toast.success(accept ? (ar ? "تم قبول العرض." : "Offer accepted.") : ar ? "تم رفض العرض." : "Offer rejected.");
    } catch {
      toast.error(ar ? "تعذّر تنفيذ الطلب — حاول مرة أخرى." : "Could not complete the action.");
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    setBusy("cancel");
    try {
      await cancelErrand(id);
      invalidate(id);
      toast.success(ar ? "تم إلغاء الطلب." : "Request cancelled.");
    } catch {
      toast.error(ar ? "تعذّر الإلغاء." : "Could not cancel.");
    } finally {
      setBusy(null);
    }
  }

  async function submitRating() {
    if (rating < 1) {
      toast.error(ar ? "اختر عدد النجوم." : "Pick a star rating.");
      return;
    }
    setBusy("rate");
    try {
      await rateErrand(id, rating, comment.trim() || undefined);
      invalidate(id);
      toast.success(ar ? "شكرًا لتقييمك." : "Thanks for the rating.");
    } catch {
      toast.error(ar ? "تعذّر إرسال التقييم." : "Could not submit the rating.");
    } finally {
      setBusy(null);
    }
  }

  const title = ar ? "تتبّع الطلب" : "Track request";

  if (errand.isLoading) {
    return (
      <DashboardShell title={title}>
        <div className="mx-auto w-full max-w-2xl px-3 pb-24 pt-3">
          <Skeleton className="h-[220px] rounded-[var(--r-card)]" />
        </div>
      </DashboardShell>
    );
  }

  if (!errand.data) {
    return (
      <DashboardShell title={title}>
        <div className="mx-auto w-full max-w-2xl px-3 pb-24 pt-6 text-center">
          <p className="text-desc text-muted-foreground">
            {ar ? "هذا الطلب غير موجود أو ليس لك." : "This request does not exist or isn't yours."}
          </p>
          <Button asChild size="sm" className="mt-3 h-9 text-desc font-bold">
            <Link to="/my/errands">{ar ? "طلباتي" : "My requests"}</Link>
          </Button>
        </div>
      </DashboardShell>
    );
  }

  const request = errand.data;
  const openForOffers = request.status === "open" || request.status === "offered";
  const cancellable = openForOffers || request.status === "accepted";
  const currentStep = ERRAND_FLOW.indexOf(request.status as ErrandStatus);

  return (
    <DashboardShell title={title}>
      <div className="mx-auto w-full max-w-2xl px-3 pb-24 pt-3">
        {/* الحالة والخط الزمني */}
        <section className="mb-3 rounded-[var(--r-card)] border border-border/70 bg-card/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <Badge className="text-desc">{errandStatusLabel(request.status, ar)}</Badge>
            <span className="text-desc text-muted-foreground">
              {formatDateTime(request.created_at)}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1">
            {ERRAND_FLOW.map((step, index) => (
              <div key={step} className="flex min-w-0 flex-1 items-center gap-1">
                <span
                  className={`h-1.5 flex-1 rounded-full ${
                    currentStep >= index && currentStep >= 0 ? "bg-primary" : "bg-border"
                  }`}
                />
              </div>
            ))}
          </div>
          <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-desc leading-snug text-foreground">
            {request.details}
          </p>
          <div className="mt-2 grid gap-1 text-desc text-muted-foreground">
            {request.pickup_label ? (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {ar ? "من" : "From"}: {request.pickup_label}
              </span>
            ) : null}
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {ar ? "إلى" : "To"}: {request.dropoff_label}
            </span>
            <span className="font-bold text-primary">
              {ar ? "تكلفة التوصيل" : "Delivery fee"}:{" "}
              {request.delivery_fee != null
                ? formatMoney(request.delivery_fee, locale)
                : ar
                  ? "بانتظار عرض الكابتن"
                  : "Waiting for an offer"}
            </span>
          </div>

          {accepted && contact.data?.phone ? (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 p-2">
              <span className="min-w-0 truncate text-desc font-semibold text-foreground">
                {contact.data.display_name}
              </span>
              <Button asChild size="sm" variant="outline" className="h-8 gap-1 text-desc">
                <a href={`tel:${contact.data.phone}`}>
                  <Phone className="h-3.5 w-3.5" />
                  {ar ? "اتصال بالكابتن" : "Call the captain"}
                </a>
              </Button>
            </div>
          ) : null}

          {cancellable ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={cancel}
              disabled={busy === "cancel"}
              className="mt-2 h-8 text-desc text-destructive"
            >
              {busy === "cancel" ? <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" /> : null}
              {ar ? "إلغاء الطلب" : "Cancel request"}
            </Button>
          ) : null}
        </section>

        {/* العروض */}
        {openForOffers ? (
          <section className="mb-3">
            <h2 className="text-section mb-2 font-bold text-foreground">
              {ar ? "عروض الكباتن" : "Captain offers"}
            </h2>
            {offers.isLoading ? (
              <Skeleton className="h-[84px] rounded-[var(--r-card)]" />
            ) : (offers.data ?? []).filter((offer) => offer.status === "pending").length === 0 ? (
              <p className="rounded-[var(--r-card)] border border-dashed border-border/70 bg-card/40 p-4 text-center text-desc text-muted-foreground">
                {ar
                  ? "ما وصل عرض بعد — الكباتن يشوفون طلبك الآن."
                  : "No offers yet — captains can see your request."}
              </p>
            ) : (
              <div className="grid gap-2">
                {offers.data!
                  .filter((offer) => offer.status === "pending")
                  .map((offer) => {
                    const captain = captains.data?.[offer.captain_id];
                    return (
                      <div
                        key={offer.id}
                        className="rounded-[var(--r-card)] border border-border/70 bg-card/60 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-desc font-bold text-foreground">
                              {captain?.display_name ?? (ar ? "كابتن كَحيل" : "Kaheel captain")}
                            </p>
                            <p className="mt-0.5 flex items-center gap-2 text-desc text-muted-foreground">
                              <span className="flex items-center gap-0.5">
                                <Star className="h-3 w-3 text-gold-dark" />
                                {formatNumber(captain?.rating_avg ?? 0)}
                              </span>
                              {offer.eta_minutes != null ? (
                                <span>
                                  {ar ? "خلال" : "in"} {offer.eta_minutes}{" "}
                                  {ar ? "دقيقة" : "min"}
                                </span>
                              ) : null}
                            </p>
                          </div>
                          <span className="shrink-0 text-desc font-black text-primary">
                            {formatMoney(offer.fee, locale)}
                          </span>
                        </div>
                        {offer.note ? (
                          <p className="mt-1 line-clamp-2 text-desc text-muted-foreground">
                            {offer.note}
                          </p>
                        ) : null}
                        <div className="mt-2 flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 flex-1 gap-1 text-desc font-bold"
                            disabled={busy === offer.id}
                            onClick={() => decide(offer.id, true)}
                          >
                            {busy === offer.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                            {ar ? "موافق" : "Accept"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 text-desc"
                            disabled={busy === offer.id}
                            onClick={() => decide(offer.id, false)}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            {ar ? "رفض" : "Reject"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </section>
        ) : null}

        {/* التقييم */}
        {request.status === "delivered" && request.rating == null ? (
          <section className="mb-3 rounded-[var(--r-card)] border border-border/70 bg-card/60 p-3">
            <h2 className="text-section mb-2 font-bold text-foreground">
              {ar ? "قيّم الكابتن" : "Rate the captain"}
            </h2>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  aria-label={`${star}`}
                  className="p-0.5"
                >
                  <Star
                    className={`h-6 w-6 ${
                      star <= rating ? "fill-gold text-gold" : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
            </div>
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={2}
              maxLength={300}
              placeholder={ar ? "كلمة عن الخدمة (اختياري)" : "A word about the service (optional)"}
              className="mt-2 resize-none text-sm"
            />
            <Button
              type="button"
              size="sm"
              onClick={submitRating}
              disabled={busy === "rate"}
              className="mt-2 h-9 text-desc font-bold"
            >
              {busy === "rate" ? <Loader2 className="me-1 h-4 w-4 animate-spin" /> : null}
              {ar ? "إرسال التقييم" : "Submit rating"}
            </Button>
          </section>
        ) : null}

        {/* السجل */}
        <section>
          <h2 className="text-section mb-2 font-bold text-foreground">
            {ar ? "سجل الطلب" : "Request log"}
          </h2>
          <div className="grid gap-[var(--sp-2)]">
            {(events.data ?? []).map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-card/40 px-3 py-2 text-desc"
              >
                <span className="font-semibold text-foreground">
                  {errandStatusLabel(event.to_status as ErrandStatus, ar)}
                </span>
                <span className="text-muted-foreground">{formatDateTime(event.created_at)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
