import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck2,
  Clock3,
  LogIn,
  Settings2,
  ShieldCheck,
  Sparkles,
  Store,
  UsersRound,
} from "lucide-react";

import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/appointments")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "كَحيل مواعيد — KAHEEL Appointments" },
      {
        name: "description",
        content:
          "احجز الخدمات والمواعيد من كَحيل، وتابع حجوزاتك من واجهة كَحيل مواعيد بحساب واحد.",
      },
      { property: "og:title", content: "كَحيل مواعيد — KAHEEL Appointments" },
      {
        property: "og:description",
        content: "حجز المواعيد والخدمات ومتابعتها من تجربة مستقلة مرتبطة بحساب كَحيل.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppointmentsLandingPage,
});

function AppointmentsLandingPage() {
  const { locale, dir } = useI18n();
  const { status, profile } = useSession();
  const isAr = locale === "ar";
  const signedIn = status === "authenticated";
  const authHref = "/auth?next=%2Fappointments";
  const bookingsAuthHref = "/auth?next=%2Fdashboard%2Fbookings";
  const providerAuthHref = "/auth?next=%2Fdashboard%2Fservice";

  const copy = isAr
    ? {
        market: "اذهب إلى سوق كَحيل",
        signIn: "تسجيل الدخول",
        brand: "كَحيل مواعيد",
        eyebrow: "KAHEEL Appointments",
        title: "احجز موعدك، وتابع كل شيء من مكان واحد.",
        body: "كَحيل مواعيد واجهة مستقلة فوق نظام حجوزات كَحيل الحالي. اختر مقدم الخدمة والموعد، ثم تابع حالة الحجز من حسابك نفسه دون إنشاء حساب أو نظام حجوزات جديد.",
        bookNow: "احجز موعدًا",
        myBookings: "مواعيدي",
        provider: "أنا مقدم خدمة",
        promise: "حساب واحد. حجز واحد. متابعة أوضح.",
        step1: "اختر الخدمة",
        step1Body: "تصفّح الخدمات المنشورة فعليًا في كَحيل واختر مقدم الخدمة المناسب.",
        step2: "اختر الموعد",
        step2Body: "استخدم المواعيد المتاحة الحالية للمختص دون إنشاء تقويم مكرر.",
        step3: "تابع الحجز",
        step3Body: "تظهر الحجوزات القادمة والسجل والحالة داخل حساب كَحيل نفسه.",
        providerTitle: "لديك نشاط يقدم مواعيد؟",
        providerBody:
          "إدارة الخدمات والمختصين وساعات العمل والحجوزات موجودة أصلًا في كَحيل. كَحيل مواعيد يستخدم هذه الطبقة نفسها حتى لا تتكرر البيانات أو الصلاحيات.",
        providerOpen: "افتح إدارة الخدمات",
        providerSettings: "إعدادات المواعيد",
        accountTitle: "نفس حساب كَحيل",
        accountBody:
          "تسجيل الدخول والجلسة والحساب النشط تبقى موحدة مع سوق كَحيل. لا يوجد Auth ثانٍ ولا هوية منفصلة للمواعيد.",
        signedInAs: "مسجل الدخول باسم",
        liveQueueTitle: "قائمة الانتظار الذكية",
        liveQueueBody:
          "الطابور المباشر ورقم الدور والوقت المتوقع سيُضاف فوق الحجز الحالي في مرحلة مستقلة، بعد ربط قاعدة KAHEEL الصحيحة واختبار RLS والتزامن. لن نعرض أرقامًا تجريبية على أنها بيانات حقيقية.",
        currentReady: "المتاح الآن",
        currentReadyBody:
          "الحجز الفعلي، الأوقات المتاحة، المختصون، إدارة مقدم الخدمة، حالات الحجز، الإلغاء وسجل الحجوزات كلها تستخدم النظام الموجود أصلًا.",
      }
    : {
        market: "Go to KAHEEL Market",
        signIn: "Sign in",
        brand: "KAHEEL Appointments",
        eyebrow: "كَحيل مواعيد",
        title: "Book your appointment and track it in one place.",
        body: "KAHEEL Appointments is a standalone experience built on KAHEEL's existing booking system. Choose a provider and slot, then track the booking with the same KAHEEL account—without a second auth or booking stack.",
        bookNow: "Book an appointment",
        myBookings: "My appointments",
        provider: "I am a service provider",
        promise: "One account. One booking. Clearer tracking.",
        step1: "Choose a service",
        step1Body: "Browse services already published in KAHEEL and choose the right provider.",
        step2: "Choose a time",
        step2Body: "Use the provider's existing real availability instead of a duplicate calendar.",
        step3: "Track the booking",
        step3Body: "Upcoming bookings, history and status stay inside the same KAHEEL account.",
        providerTitle: "Do you offer appointment-based services?",
        providerBody:
          "Service setup, professionals, working hours and bookings already exist in KAHEEL. Appointments reuses the same layer so data and permissions are never duplicated.",
        providerOpen: "Open service management",
        providerSettings: "Appointment settings",
        accountTitle: "Your existing KAHEEL account",
        accountBody:
          "Sign-in, session and active account remain shared with KAHEEL Market. There is no second auth system or separate appointment identity.",
        signedInAs: "Signed in as",
        liveQueueTitle: "Smart live queue",
        liveQueueBody:
          "Live queue position and ETA will be added on top of the current booking model in a separate phase, after the correct KAHEEL database is connected and RLS/concurrency are verified. No demo queue values are presented as real data.",
        currentReady: "Available now",
        currentReadyBody:
          "Real booking, available slots, professionals, provider management, booking statuses, cancellation and booking history already use the existing KAHEEL system.",
      };

  const DirectionArrow = isAr ? ArrowLeft : ArrowRight;

  return (
    <main dir={dir} className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link to="/appointments" className="min-w-0">
            <span className="block truncate text-base font-black tracking-tight sm:text-lg">
              {copy.brand}
            </span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {copy.eyebrow}
            </span>
          </Link>

          <div className="ms-auto flex items-center gap-2">
            <LanguageToggle compact />
            {!signedIn ? (
              <a
                href={authHref}
                className="hidden min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-muted-foreground transition hover:bg-secondary hover:text-foreground sm:inline-flex"
              >
                <LogIn className="size-4" aria-hidden />
                {copy.signIn}
              </a>
            ) : null}
            <Button asChild size="sm" variant="outline" className="h-10 rounded-xl">
              <Link to="/">
                <Store className="size-4" aria-hidden />
                <span className="hidden sm:inline">{copy.market}</span>
                <span className="sm:hidden">كَحيل</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-border/70">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_50%_0%,var(--color-secondary),transparent_70%)] opacity-80" />
        <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground shadow-sm">
              <Sparkles className="size-4 text-primary" aria-hidden />
              {copy.promise}
            </div>
            <h1 className="mt-5 text-4xl font-black leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
              {copy.title}
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base sm:leading-8">
              {copy.body}
            </p>

            {signedIn && profile?.full_name ? (
              <p className="mt-4 inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground">
                <ShieldCheck className="size-4" aria-hidden />
                {copy.signedInAs}: {profile.full_name}
              </p>
            ) : null}

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild className="min-h-12 rounded-xl px-5">
                <Link to="/services/">
                  <CalendarCheck2 className="size-4" aria-hidden />
                  {copy.bookNow}
                  <DirectionArrow className="size-4" aria-hidden />
                </Link>
              </Button>

              {signedIn ? (
                <Button asChild variant="outline" className="min-h-12 rounded-xl px-5">
                  <Link to="/dashboard/bookings">
                    <Clock3 className="size-4" aria-hidden />
                    {copy.myBookings}
                  </Link>
                </Button>
              ) : (
                <a
                  href={bookingsAuthHref}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-bold transition hover:bg-secondary"
                >
                  <Clock3 className="size-4" aria-hidden />
                  {copy.myBookings}
                </a>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-border bg-card p-4 shadow-raised sm:p-5">
            <div className="rounded-[1.5rem] bg-secondary/65 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-muted-foreground">{copy.currentReady}</p>
                  <p className="mt-1 text-lg font-black">{copy.brand}</p>
                </div>
                <span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground">
                  <CalendarCheck2 className="size-5" aria-hidden />
                </span>
              </div>
              <p className="mt-5 text-sm leading-7 text-muted-foreground">{copy.currentReadyBody}</p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl border bg-card p-3 text-xs font-bold">
                  <Clock3 className="mb-2 size-4 text-primary" aria-hidden />
                  {isAr ? "أوقات متاحة فعلية" : "Real availability"}
                </div>
                <div className="rounded-2xl border bg-card p-3 text-xs font-bold">
                  <UsersRound className="mb-2 size-4 text-primary" aria-hidden />
                  {isAr ? "مختصون وحجوزات" : "Professionals & bookings"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Sparkles, title: copy.step1, body: copy.step1Body },
            { icon: CalendarCheck2, title: copy.step2, body: copy.step2Body },
            { icon: Clock3, title: copy.step3, body: copy.step3Body },
          ].map(({ icon: Icon, title, body }, index) => (
            <article key={title} className="rounded-3xl border border-border bg-card p-5 shadow-panel sm:p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="text-xs font-black text-muted-foreground">0{index + 1}</span>
              </div>
              <h2 className="mt-5 text-lg font-black">{title}</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-16">
          <div className="rounded-3xl bg-secondary/60 p-6 sm:p-8">
            <UsersRound className="size-7 text-primary" aria-hidden />
            <h2 className="mt-4 text-2xl font-black">{copy.providerTitle}</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{copy.providerBody}</p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {signedIn ? (
                <Button asChild>
                  <Link to="/dashboard/service">
                    <UsersRound className="size-4" aria-hidden />
                    {copy.providerOpen}
                  </Link>
                </Button>
              ) : (
                <a
                  href={providerAuthHref}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-primary-dark"
                >
                  <UsersRound className="size-4" aria-hidden />
                  {copy.provider}
                </a>
              )}
              {signedIn ? (
                <Button asChild variant="outline">
                  <Link to="/dashboard/service/settings">
                    <Settings2 className="size-4" aria-hidden />
                    {copy.providerSettings}
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-border p-6 sm:p-8">
            <ShieldCheck className="size-7 text-primary" aria-hidden />
            <h2 className="mt-4 text-2xl font-black">{copy.accountTitle}</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{copy.accountBody}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4 py-14 text-center sm:px-6 lg:py-20">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
          <Clock3 className="size-6" aria-hidden />
        </span>
        <h2 className="mt-4 text-2xl font-black">{copy.liveQueueTitle}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
          {copy.liveQueueBody}
        </p>
      </section>

      <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted-foreground">
        {isAr ? "كَحيل مواعيد · مرتبط بمنصة كَحيل" : "KAHEEL Appointments · Connected to KAHEEL"}
      </footer>
    </main>
  );
}
