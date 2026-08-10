/**
 * صفحة الطلب في «كَحيل عقار» — /aqar/book/{المعرّف}
 *
 * مسارنا «طلب بلا دفع»: لا بوابة دفع ولا مبلغ محتجز ولا ضمان مالي. الصفحة
 * تجمع بيانات الطلب، تعرض ملخّصًا تقديريًا للسعر (بلا رسوم مخترعة)، تشرح
 * السياسات وحدود مسؤولية المنصة بصدق، ثم تُرسل الطلب بحالة «بانتظار الرد».
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  CalendarDays,
  Info,
  MessagesSquare,
  ShieldAlert,
  Timer,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AqarShell } from "@/components/marketplace/aqar/AqarShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { AQAR_TYPE_LABELS } from "@/lib/aqar-imagery";
import { fetchAqarListing, fetchAqarProvider, fetchAqarUsdRate, formatAqarPrice } from "@/lib/mkt-aqar";
import {
  AQAR_REQUEST_TTL_HOURS,
  createAqarBooking,
  estimateAqarTotal,
  nightsBetween,
} from "@/lib/mkt-aqar-booking";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/aqar/book/$id")({
  head: () => ({
    meta: [
      { title: "إرسال الطلب — كَحيل عقار" },
      {
        name: "description",
        content:
          "أرسل طلب حجز أو معاينة إلى المعلن مباشرة على كَحيل عقار: التواريخ، عدد الضيوف، وملخّص تقديري للسعر بلا أي دفع عبر المنصة.",
      },
      { property: "og:title", content: "إرسال الطلب — كَحيل عقار" },
      {
        property: "og:description",
        content: "طلب حجز أو معاينة بلا دفع عبر المنصة، مع ملخّص السعر والسياسات.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AqarBookPage,
});

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-2 py-1">
      <span className="text-desc text-muted-foreground">{label}</span>
      <strong className="text-desc font-bold text-foreground">{value}</strong>
    </li>
  );
}

function AqarBookPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");

  const listing = useQuery({ queryKey: ["aqar", "listing", id], queryFn: () => fetchAqarListing(id) });
  const usdRate = useQuery({
    queryKey: ["aqar", "usd-rate"],
    queryFn: fetchAqarUsdRate,
    staleTime: 5 * 60 * 1000,
  });
  const providerId = listing.data?.provider_id;
  const provider = useQuery({
    queryKey: ["aqar", "provider", providerId],
    queryFn: () => fetchAqarProvider(providerId as string),
    enabled: Boolean(providerId),
  });
  const session = useQuery({
    queryKey: ["auth", "session-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });

  const send = useMutation({
    mutationFn: async () => {
      const row = listing.data;
      if (!row) throw new Error("الإعلان غير متاح.");
      const daily = row.deal_track === "daily_rent";
      return createAqarBooking({
        listing_id: row.id,
        provider_id: row.provider_id,
        check_in: daily ? checkIn || null : null,
        check_out: daily ? checkOut || null : null,
        guests: daily && guests ? Number(guests) : null,
        customer_name: name,
        customer_phone: phone,
        message: note,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["aqar", "my-bookings"] });
      toast.success("أُرسل طلبك إلى المعلن. تابع حالته في «طلباتي».");
      void navigate({ to: "/aqar/requests" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (listing.isPending) {
    return (
      <AqarShell title="إرسال الطلب" back="/aqar" backLabel="عقار">
        <div className="mx-auto max-w-3xl space-y-3 p-4">
          <Skeleton className="h-24 w-full rounded-[var(--r-card)]" />
          <Skeleton className="h-40 w-full rounded-[var(--r-card)]" />
        </div>
      </AqarShell>
    );
  }

  const row = listing.data;
  if (!row) {
    return (
      <AqarShell title="إرسال الطلب" back="/aqar" backLabel="عقار">
        <div className="mx-auto max-w-3xl p-4">
          <p className="text-body text-foreground">هذا الإعلان غير متاح أو تم إيقاف نشره.</p>
          <Link to="/aqar" className="mt-3 inline-block text-desc font-bold text-primary">
            رجوع إلى كَحيل عقار
          </Link>
        </div>
      </AqarShell>
    );
  }

  const daily = row.deal_track === "daily_rent";
  const nights = nightsBetween(checkIn || null, checkOut || null);
  const estimate = estimateAqarTotal(row, nights);
  const price = formatAqarPrice(row, usdRate.data ?? null);
  const signedIn = Boolean(session.data);
  const datesMissing = daily && (!checkIn || nights <= 0);
  const isSale = row.deal_track === "sale";

  return (
    <AqarShell
      title={isSale ? "طلب معاينة" : "طلب حجز"}
      subtitle={`${row.city}${row.district ? ` — ${row.district}` : ""}`}
      back="/aqar"
      backLabel="عقار"
    >
      <div className="mx-auto w-full max-w-3xl p-4 pb-10">
        {/* ملخّص العقار المطلوب */}
        <section className="rounded-[var(--r-card)] border border-border bg-card p-4">
          <span className="k-pill px-3 py-0.5 text-nav font-bold">
            {AQAR_TYPE_LABELS[row.property_type] ?? "عقار"}
          </span>
          <h1 className="mt-2 text-section font-extrabold text-foreground">{row.title}</h1>
          <p className="mt-1 text-desc text-muted-foreground">
            {provider.data ? `المعلن: ${provider.data.display_name}` : "المعلن"}
            {provider.data?.verification_status === "verified" ? " ✔ موثّق" : ""}
          </p>
          {row.is_demo ? (
            <p className="mt-2 rounded-xl bg-secondary px-3 py-2 text-desc font-bold text-secondary-foreground">
              إعلان تجريبي لعرض شكل المنصة — لا تُقبل عليه طلبات حقيقية.
            </p>
          ) : null}
        </section>

        {/* تفاصيل الطلب */}
        <section className="mt-4 rounded-[var(--r-card)] border border-border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-section font-extrabold text-foreground">
            <CalendarDays className="size-5 text-primary" aria-hidden />
            تفاصيل الطلب
          </h2>

          {daily ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="aqar-in">تاريخ الدخول</Label>
                <Input
                  id="aqar-in"
                  type="date"
                  min={today()}
                  value={checkIn}
                  onChange={(event) => setCheckIn(event.target.value)}
                  style={{ minHeight: 44 }}
                />
              </div>
              <div>
                <Label htmlFor="aqar-out">تاريخ الخروج</Label>
                <Input
                  id="aqar-out"
                  type="date"
                  min={checkIn || today()}
                  value={checkOut}
                  onChange={(event) => setCheckOut(event.target.value)}
                  style={{ minHeight: 44 }}
                />
              </div>
              <div>
                <Label htmlFor="aqar-guests" className="flex items-center gap-1">
                  <Users className="size-4 text-primary" aria-hidden />
                  عدد الضيوف
                </Label>
                <Input
                  id="aqar-guests"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={30}
                  value={guests}
                  onChange={(event) => setGuests(event.target.value)}
                  style={{ minHeight: 44 }}
                />
              </div>
            </div>
          ) : (
            <p className="text-desc text-muted-foreground">
              {isSale
                ? "اطلب معاينة العقار واتفق مع المعلن على الموعد داخل المحادثة."
                : "الإيجار الطويل يُتفق على مدته وشروطه مع المعلن مباشرة."}
            </p>
          )}

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="aqar-name">اسمك</Label>
              <Input
                id="aqar-name"
                value={name}
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                placeholder="الاسم كما يظهر للمعلن"
                style={{ minHeight: 44 }}
              />
            </div>
            <div>
              <Label htmlFor="aqar-phone">رقم للتواصل</Label>
              <Input
                id="aqar-phone"
                type="tel"
                dir="ltr"
                value={phone}
                maxLength={20}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="09xxxxxxxx"
                style={{ minHeight: 44 }}
              />
            </div>
          </div>

          <div className="mt-3">
            <Label htmlFor="aqar-note">ملاحظة للمعلن (اختياري)</Label>
            <Textarea
              id="aqar-note"
              value={note}
              maxLength={600}
              rows={3}
              onChange={(event) => setNote(event.target.value)}
              placeholder="وقت الوصول، عدد الأطفال، أي طلب خاص…"
            />
          </div>
          <p className="mt-1 text-nav text-muted-foreground">
            يظهر اسمك ورقمك للمعلن فقط بعد إرسال الطلب، ولا يُنشر في أي مكان عام.
          </p>
        </section>

        {/* الملخّص المالي — تقدير للعرض فقط */}
        <section className="mt-4 rounded-[var(--r-card)] border border-border bg-card p-4">
          <h2 className="mb-2 text-section font-extrabold text-foreground">الملخّص المالي</h2>
          <ul className="divide-y divide-border">
            {estimate.lines.map((line) => (
              <Row key={line.label} label={line.label} value={line.value} />
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
            <span className="text-body font-bold text-foreground">الإجمالي التقديري</span>
            <strong className="text-price font-extrabold text-primary">
              {estimate.total ?? `${price.main}${price.period ? ` ${price.period}` : ""}`}
            </strong>
          </div>
          {price.secondary && !estimate.total ? (
            <p className="text-nav text-muted-foreground">≈ {price.secondary}</p>
          ) : null}
          <p className="mt-2 flex gap-2 rounded-xl bg-muted px-3 py-2 text-desc text-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              لا يوجد دفع عبر كَحيل ولا مبلغ محتجز. الرقم أعلاه تقدير من سعر الإعلان × المدة،
              والمبلغ النهائي يُتفق عليه مع المعلن ويُسدَّد له مباشرة.
            </span>
          </p>
        </section>

        {/* السياسات */}
        <section className="mt-4 rounded-[var(--r-card)] border border-border bg-card p-4">
          <h2 className="mb-2 flex items-center gap-2 text-section font-extrabold text-foreground">
            <Timer className="size-5 text-primary" aria-hidden />
            السياسات والمدد
          </h2>
          <ul className="list-disc space-y-1 ps-5 text-desc text-foreground">
            <li>
              الطلب يبقى «بانتظار الرد» {AQAR_REQUEST_TTL_HOURS.toLocaleString("en-US")} ساعة، ثم
              ينتهي تلقائيًا إن لم يردّ المعلن.
            </li>
            <li>يمكنك إلغاء طلبك في أي وقت قبل قبوله من صفحة «طلباتي».</li>
            <li>
              سياسة الإلغاء بعد القبول والتأمين والمدة يحددها المعلن نفسه — اتفق عليها كتابةً في
              المحادثة قبل الالتزام.
            </li>
            <li>تمديد المدة يُرسل كطلب جديد للمعلن، فقراره وحده يعتمده.</li>
          </ul>
        </section>

        {/* الحماية الصادقة */}
        <section className="mt-4 rounded-[var(--r-card)] border border-border bg-card p-4">
          <h2 className="mb-2 flex items-center gap-2 text-section font-extrabold text-foreground">
            <ShieldAlert className="size-5 text-primary" aria-hidden />
            ما تضمنه كَحيل وما لا تضمنه
          </h2>
          <ul className="space-y-1 text-desc text-foreground">
            <li className="flex gap-2">
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              نضمن: سجلًا موثّقًا لطلبك ومحادثتك، وإمكانية الإبلاغ عن أي إعلان مخالف، ومراجعة
              البلاغات وإيقاف المخالفين.
            </li>
            <li className="flex gap-2">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              لا نضمن: أي أموال — لا نحتجز مبلغًا ولا نستردّه ولا نعوّضه، لأن الدفع يجري خارج
              المنصة بينك وبين المعلن.
            </li>
          </ul>
          <p className="mt-2 text-nav text-muted-foreground">
            راجع{" "}
            <Link to="/legal/terms" className="font-bold text-primary">
              شروط الاستخدام
            </Link>{" "}
            و
            <Link to="/legal/privacy" className="font-bold text-primary">
              سياسة الخصوصية
            </Link>
            .
          </p>
        </section>

        {/* الإرسال */}
        <div className="mt-4 flex flex-col gap-2">
          {signedIn ? (
            <Button
              className="w-full"
              style={{ minHeight: 48 }}
              disabled={send.isPending || datesMissing}
              onClick={() => send.mutate()}
            >
              {send.isPending
                ? "جارٍ الإرسال…"
                : isSale
                  ? "إرسال طلب المعاينة"
                  : "إرسال طلب الحجز"}
            </Button>
          ) : (
            <Link
              to="/auth"
              search={{ next: `/aqar/book/${id}` } as never}
              className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 text-body font-bold text-primary-foreground"
              style={{ minHeight: 48 }}
            >
              سجّل الدخول لإرسال الطلب
            </Link>
          )}
          {datesMissing ? (
            <p className="text-desc text-muted-foreground">اختر تاريخ الدخول والخروج أولًا.</p>
          ) : null}
          <Link
            to="/my/messages"
            className="inline-flex w-full items-center justify-center gap-1 rounded-full border border-border bg-card px-4 text-body font-bold text-foreground"
            style={{ minHeight: 44 }}
          >
            <MessagesSquare className="size-5 text-primary" aria-hidden />
            محادثة المعلن أولًا
          </Link>
        </div>
      </div>
    </AqarShell>
  );
}
