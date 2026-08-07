import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck2,
  Clock3,
  LogIn,
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
          "كَحيل مواعيد: واجهة مستقلة لحجز المواعيد ومتابعة الدور، بحساب كَحيل موحد.",
      },
      { property: "og:title", content: "كَحيل مواعيد — KAHEEL Appointments" },
      {
        property: "og:description",
        content: "احجز موعدك وتابع دورك من واجهة كَحيل مواعيد المستقلة.",
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

  const copy = isAr
    ? {
        market: "اذهب إلى سوق كَحيل",
        signIn: "تسجيل الدخول",
        brand: "كَحيل مواعيد",
        eyebrow: "KAHEEL Appointments",
        title: "موعدك أوضح، وانتظارك أقل.",
        body: "واجهة مستقلة للمواعيد صُممت لتجمع الحجز المسبق وقائمة الانتظار ومتابعة الدور في تجربة بسيطة، مع حساب كَحيل واحد.",
        primary: signedIn ? "ابدأ من كَحيل مواعيد" : "سجّل الدخول للمتابعة",
        secondary: "أنا مقدم خدمة",
        promise: "لا تنتظر مكانك… تابع دورك.",
        step1: "احجز",
        step1Body: "اختر مقدم الخدمة والوقت المناسب عند تفعيل دليل المواعيد.",
        step2: "تابع دورك",
        step2Body: "ستظهر حالة الموعد والانتظار من واجهة واحدة دون خلطها مع السوق.",
        step3: "حان موعدك",
        step3Body: "التنبيه والدخول إلى الجلسة سيكونان جزءًا من نفس الرحلة.",
        providersTitle: "مساحة مستقلة لمقدمي الخدمة",
        providersBody:
          "ستُبنى إدارة الجداول والطوابير على نطاق مواعيد مستقل، بينما تبقى هوية المستخدم وتسجيل الدخول مشتركة مع كَحيل.",
        accountTitle: "حساب واحد الآن، وفصل ممكن لاحقًا",
        accountBody:
          "لا ننشئ نظام دخول ثانيًا. كَحيل مواعيد يستخدم جلسة كَحيل الحالية، مع إبقاء بيانات المواعيد في نطاق منفصل قابل للنقل مستقبلًا.",
        signedInAs: "مسجل الدخول باسم",
        foundation: "الأساس الآمن جاهز",
        foundationBody:
          "هذه المرحلة تثبت الواجهة المستقلة والهوية المشتركة فقط. لن نفعّل حجزًا أو طابورًا وهميًا قبل اعتماد طبقة البيانات والصلاحيات واختبارها.",
      }
    : {
        market: "Go to KAHEEL Market",
        signIn: "Sign in",
        brand: "KAHEEL Appointments",
        eyebrow: "كَحيل مواعيد",
        title: "Clearer appointments. Less waiting.",
        body: "A standalone appointments experience for scheduled bookings, live queues and turn tracking, powered by one KAHEEL account.",
        primary: signedIn ? "Start with KAHEEL Appointments" : "Sign in to continue",
        secondary: "I am a service provider",
        promise: "Track your turn instead of waiting in place.",
        step1: "Book",
        step1Body: "Choose a provider and suitable time once the appointments directory is enabled.",
        step2: "Track your turn",
        step2Body: "Appointment and queue status will live in one experience, separate from the market.",
        step3: "It is your turn",
        step3Body: "Notifications and session entry will be part of the same journey.",
        providersTitle: "A dedicated provider workspace",
        providersBody:
          "Schedules and queues will live in an appointments-specific domain while user identity and sign-in remain shared with KAHEEL.",
        accountTitle: "One account now, separable later",
        accountBody:
          "We do not create a second authentication system. KAHEEL Appointments reuses the current KAHEEL session while appointments data stays in an isolated domain that can be moved later.",
        signedInAs: "Signed in as",
        foundation: "Safe foundation is ready",
        foundationBody:
          "This stage establishes the standalone interface and shared identity only. Booking and queue actions stay disabled until their data and permission layer is approved and tested.",
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

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              {signedIn ? (
                <a
                  href="#foundation"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary-dark"
                >
                  {copy.primary}
                  <DirectionArrow className="size-4" aria-hidden />
                </a>
              ) : (
                <a
                  href={authHref}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary-dark"
                >
                  {copy.primary}
                  <DirectionArrow className="size-4" aria-hidden />
                </a>
              )}
              <a
                href="#providers"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-bold transition hover:bg-secondary"
              >
                <UsersRound className="size-4" aria-hidden />
                {copy.secondary}
              </a>
            </div>
          </div>

          <div className="rounded-[2rem] border border-border bg-card p-4 shadow-raised sm:p-5">
            <div className="rounded-[1.5rem] bg-secondary/65 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-muted-foreground">{copy.brand}</p>
                  <p className="mt-1 text-lg font-black">{isAr ? "متابعة الموعد" : "Appointment status"}</p>
                </div>
                <span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground">
                  <CalendarCheck2 className="size-5" aria-hidden />
                </span>
              </div>

              <div className="mt-7 space-y-3">
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
                      <Clock3 className="size-5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {isAr ? "الوقت المتوقع" : "Estimated time"}
                      </p>
                      <p className="mt-0.5 font-black">—</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-dashed border-border bg-background/70 p-4 text-center text-xs leading-6 text-muted-foreground">
                  {isAr
                    ? "لن نعرض رقم دور أو وقتًا تجريبيًا على أنه حقيقي. تظهر البيانات هنا فقط بعد ربط طبقة المواعيد الآمنة."
                    : "No fake queue number or time is shown as real data. Live status appears here only after the secure appointments data layer is connected."}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: CalendarCheck2, title: copy.step1, body: copy.step1Body },
            { icon: UsersRound, title: copy.step2, body: copy.step2Body },
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

      <section id="providers" className="border-y border-border bg-card">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-16">
          <div className="rounded-3xl bg-secondary/60 p-6 sm:p-8">
            <UsersRound className="size-7 text-primary" aria-hidden />
            <h2 className="mt-4 text-2xl font-black">{copy.providersTitle}</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{copy.providersBody}</p>
          </div>
          <div className="rounded-3xl border border-border p-6 sm:p-8">
            <ShieldCheck className="size-7 text-primary" aria-hidden />
            <h2 className="mt-4 text-2xl font-black">{copy.accountTitle}</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{copy.accountBody}</p>
          </div>
        </div>
      </section>

      <section id="foundation" className="mx-auto w-full max-w-4xl px-4 py-14 text-center sm:px-6 lg:py-20">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
          <ShieldCheck className="size-6" aria-hidden />
        </span>
        <h2 className="mt-4 text-2xl font-black sm:text-3xl">{copy.foundation}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
          {copy.foundationBody}
        </p>
        {!signedIn ? (
          <a
            href={authHref}
            className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary-dark"
          >
            {copy.signIn}
            <DirectionArrow className="size-4" aria-hidden />
          </a>
        ) : null}
      </section>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© 2026 KAHEEL — {isAr ? "كَحيل مواعيد" : "Appointments"}</p>
          <Link to="/" className="font-bold text-foreground hover:text-primary">
            {copy.market}
          </Link>
        </div>
      </footer>
    </main>
  );
}
