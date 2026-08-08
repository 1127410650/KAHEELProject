import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  MessageSquareText,
  ShieldCheck,
  Store,
} from "lucide-react";
import { toast } from "sonner";

import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { enablePersistentSession } from "@/lib/auth-storage";
import { useSession } from "@/lib/session";
import { completeAppointmentProfile, getMyContext } from "@/appointments/api";
import { MARKET_AUTH_URL, MARKET_URL, REGISTER_URL } from "@/appointments/copy";
import { maskAppointmentPhone, normalizeAppointmentPhone } from "@/appointments/phone";
import { Card } from "@/appointments/ui";

export const Route = createFileRoute("/appointments-access")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الدخول برمز الجوال — كَحيل مواعيد" },
      {
        name: "description",
        content: "دخول سريع إلى كَحيل مواعيد بالاسم الكامل ورمز تحقق الجوال دون كلمة مرور.",
      },
      { property: "og:title", content: "الدخول برمز الجوال — كَحيل مواعيد" },
      {
        property: "og:description",
        content: "تحقق من رقم جوالك وأكمل حجز موعدك دون كلمة مرور.",
      },
    ],
  }),
  component: AppointmentsAccessPage,
});

type VerificationType = "sms" | "phone_change";
type Step = "details" | "code" | "done";

function safeNext() {
  if (typeof window === "undefined") return "/appointments";
  const value = new URLSearchParams(window.location.search).get("next") || "/appointments";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/appointments";
  }
  return value;
}

function authMessage(error: unknown, isAr: boolean) {
  const message = String((error as { message?: string })?.message ?? error ?? "").toLowerCase();
  if (message.includes("rate") || message.includes("frequency")) {
    return isAr
      ? "تم طلب الرمز عدة مرات. انتظر قليلًا ثم حاول مجددًا."
      : "Too many code requests. Please wait before trying again.";
  }
  if (message.includes("expired") || message.includes("invalid token") || message.includes("otp")) {
    return isAr
      ? "الرمز غير صحيح أو انتهت صلاحيته. اطلب رمزًا جديدًا."
      : "The code is invalid or expired. Request a new code.";
  }
  if (
    message.includes("sms") ||
    message.includes("phone provider") ||
    message.includes("provider is not enabled")
  ) {
    return isAr
      ? "تعذر إرسال رسالة التحقق حاليًا. تحقق من إعداد خدمة الرسائل وحاول لاحقًا."
      : "The verification message could not be sent. Check the SMS service configuration.";
  }
  if (message.includes("phone_not_verified")) {
    return isAr ? "لم يكتمل توثيق رقم الجوال." : "The mobile number was not verified.";
  }
  return isAr
    ? "تعذر إكمال التحقق. راجع البيانات وحاول مرة أخرى."
    : "Verification could not be completed. Check your details and try again.";
}

function AppointmentsAccessPage() {
  const { locale, dir } = useI18n();
  const session = useSession();
  const isAr = locale === "ar";
  const next = useMemo(() => safeNext(), []);
  const Arrow = isAr ? ArrowLeft : ArrowRight;

  const [step, setStep] = useState<Step>("details");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [token, setToken] = useState("");
  const [verificationType, setVerificationType] = useState<VerificationType>("sms");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    enablePersistentSession();
  }, []);

  useEffect(() => {
    if (session.status === "loading") return;

    const user = session.session?.user;
    setFullName((current) =>
      current ||
      session.profile?.full_name ||
      String(user?.user_metadata?.["full_name"] ?? ""),
    );
    setPhone((current) => current || user?.phone || session.profile?.phone || "");

    if (session.status !== "authenticated") {
      setChecking(false);
      return;
    }

    let active = true;
    void getMyContext()
      .then((context) => {
        if (!active) return;
        if (context.profile?.phone_e164 && context.profile.display_name) {
          window.location.replace(next);
          return;
        }
        setChecking(false);
      })
      .catch(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, [next, session.profile, session.session?.user, session.status]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function finishProfile(name: string) {
    await completeAppointmentProfile(name);
    await session.refresh();
    setStep("done");
    window.setTimeout(() => window.location.replace(next), 350);
  }

  async function requestCode(event?: FormEvent) {
    event?.preventDefault();
    const name = fullName.trim().replace(/\s+/g, " ");
    const normalizedPhone = normalizeAppointmentPhone(phone);

    if (name.length < 2 || name.length > 100) {
      toast.error(isAr ? "أدخل الاسم الكامل بشكل صحيح." : "Enter a valid full name.");
      return;
    }
    if (!normalizedPhone) {
      toast.error(
        isAr
          ? "أدخل رقم الجوال مع مفتاح الدولة، أو رقمًا سوريًا يبدأ بـ09 أو سعوديًا يبدأ بـ05."
          : "Use an international mobile number, or a Syrian 09 / Saudi 05 number.",
      );
      return;
    }

    setBusy(true);
    try {
      enablePersistentSession();
      setFullName(name);
      setPhone(normalizedPhone);

      const authUser = session.session?.user;
      const currentPhone = normalizeAppointmentPhone(authUser?.phone ?? "");
      const currentPhoneConfirmed = Boolean(authUser?.phone_confirmed_at);

      if (
        session.status === "authenticated" &&
        currentPhoneConfirmed &&
        currentPhone === normalizedPhone
      ) {
        await finishProfile(name);
        return;
      }

      if (session.status === "authenticated") {
        const { error } = await supabase.auth.updateUser({ phone: normalizedPhone });
        if (error) throw error;
        setVerificationType("phone_change");
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          phone: normalizedPhone,
          options: {
            shouldCreateUser: true,
            data: {
              full_name: name,
              signup_origin: "appointments",
            },
          },
        });
        if (error) throw error;
        setVerificationType("sms");
      }

      setToken("");
      setCooldown(60);
      setStep("code");
      toast.success(
        isAr ? "أرسلنا رمز التحقق إلى جوالك." : "A verification code was sent to your mobile.",
      );
    } catch (error) {
      toast.error(authMessage(error, isAr));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    const normalizedPhone = normalizeAppointmentPhone(phone);
    const code = token.replace(/\D/g, "");
    if (!normalizedPhone || code.length < 6) {
      toast.error(isAr ? "أدخل رمز التحقق كاملًا." : "Enter the complete verification code.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: code,
        type: verificationType,
      });
      if (error) throw error;
      await finishProfile(fullName.trim().replace(/\s+/g, " "));
    } catch (error) {
      toast.error(authMessage(error, isAr));
    } finally {
      setBusy(false);
    }
  }

  if (checking || session.status === "loading") {
    return (
      <main dir={dir} className="grid min-h-dvh place-items-center bg-background p-6">
        <Loader2 className="size-7 animate-spin text-primary" aria-label={isAr ? "جاري التحميل" : "Loading"} />
      </main>
    );
  }

  return (
    <main dir={dir} className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/80 bg-background/95">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <a href="/appointments" className="min-w-0">
            <strong className="block truncate text-base font-black">{isAr ? "كَحيل مواعيد" : "KAHEEL Appointments"}</strong>
            <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {isAr ? "KAHEEL Appointments" : "كَحيل مواعيد"}
            </span>
          </a>
          <div className="ms-auto flex items-center gap-2">
            <LanguageToggle compact />
            <Button asChild size="sm" variant="outline" className="h-10 rounded-xl">
              <a href={MARKET_URL}>
                <Store className="size-4" />
                <span className="hidden sm:inline">{isAr ? "اذهب إلى سوق كَحيل" : "Go to KAHEEL Market"}</span>
                <span className="sm:hidden">كَحيل</span>
              </a>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_28rem] lg:py-16">
        <div className="hidden lg:block">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-black text-primary">
            <ShieldCheck className="size-4" />
            {isAr ? "دخول آمن بدون كلمة مرور" : "Secure passwordless access"}
          </span>
          <h1 className="mt-5 max-w-xl text-5xl font-black leading-tight">
            {isAr ? "اسمك، جوالك، ثم موعدك." : "Your name, mobile, then your appointment."}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-8 text-muted-foreground">
            {isAr
              ? "لا نطلب بريدًا إلكترونيًا أو كلمة مرور من عميل المواعيد. يصل رمز قصير إلى رقم الجوال، وبعد التحقق يمكنك الحجز ومتابعة دورك."
              : "Appointment customers do not need email or a password. Verify the short mobile code, then book and track your turn."}
          </p>
        </div>

        <Card className="p-5 shadow-raised sm:p-7">
          {step === "details" ? (
            <form onSubmit={(event) => void requestCode(event)}>
              <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
                <MessageSquareText className="size-6" />
              </span>
              <h1 className="mt-4 text-2xl font-black">
                {isAr ? "الدخول إلى كَحيل مواعيد" : "Access KAHEEL Appointments"}
              </h1>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                {isAr
                  ? "أدخل الاسم الكامل ورقم الجوال فقط. سنرسل لك رمز تحقق، ولن نطلب كلمة مرور."
                  : "Enter only your full name and mobile number. We will send a code; no password is required."}
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="appointments-full-name">{isAr ? "الاسم الكامل" : "Full name"}</Label>
                  <Input
                    id="appointments-full-name"
                    autoComplete="name"
                    className="mt-2 h-12"
                    maxLength={100}
                    required
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="appointments-phone">{isAr ? "رقم الجوال" : "Mobile number"}</Label>
                  <Input
                    id="appointments-phone"
                    dir="ltr"
                    inputMode="tel"
                    autoComplete="tel"
                    className="mt-2 h-12 text-start"
                    placeholder="+9639XXXXXXXX"
                    required
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                  <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                    {isAr
                      ? "استخدم مفتاح الدولة. نقبل أيضًا 09 للسعودية؟ لا، 09 لسوريا و05 للسعودية تلقائيًا."
                      : "Use the country code. Syrian 09 and Saudi 05 formats are also accepted automatically."}
                  </p>
                </div>
              </div>

              <Button type="submit" className="mt-6 h-12 w-full rounded-xl" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                {isAr ? "إرسال رمز التحقق" : "Send verification code"}
                {!busy ? <Arrow className="size-4" /> : null}
              </Button>

              {session.status === "unauthenticated" ? (
                <div className="mt-6 border-t border-border pt-5 text-center">
                  <p className="text-xs text-muted-foreground">
                    {isAr ? "مقدم خدمة أو لديك حساب في سوق كَحيل؟" : "A provider or already have a KAHEEL Market account?"}
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Button asChild variant="outline" className="flex-1">
                      <a href={MARKET_AUTH_URL}>{isAr ? "دخول حساب كَحيل" : "KAHEEL account sign-in"}</a>
                    </Button>
                    <Button asChild variant="ghost" className="flex-1">
                      <a href={REGISTER_URL}>{isAr ? "التسجيل في السوق" : "Market registration"}</a>
                    </Button>
                  </div>
                </div>
              ) : null}
            </form>
          ) : null}

          {step === "code" ? (
            <form onSubmit={(event) => void verifyCode(event)}>
              <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
                <KeyRound className="size-6" />
              </span>
              <h1 className="mt-4 text-2xl font-black">{isAr ? "أدخل رمز التحقق" : "Enter the verification code"}</h1>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                {isAr ? "أرسلنا الرمز إلى" : "We sent the code to"}{" "}
                <span dir="ltr" className="font-black text-foreground">{maskAppointmentPhone(phone)}</span>
              </p>
              <div className="mt-6">
                <Label htmlFor="appointments-token">{isAr ? "رمز التحقق" : "Verification code"}</Label>
                <Input
                  id="appointments-token"
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="mt-2 h-14 text-center text-2xl font-black tracking-[0.35em]"
                  maxLength={10}
                  placeholder="••••••"
                  required
                  value={token}
                  onChange={(event) => setToken(event.target.value.replace(/\D/g, ""))}
                />
              </div>
              <Button type="submit" className="mt-6 h-12 w-full rounded-xl" disabled={busy || token.length < 6}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                {isAr ? "تحقق ومتابعة" : "Verify and continue"}
              </Button>
              <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                <button
                  type="button"
                  className="font-bold text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setStep("details");
                    setToken("");
                  }}
                >
                  {isAr ? "تغيير الرقم" : "Change number"}
                </button>
                <button
                  type="button"
                  disabled={busy || cooldown > 0}
                  className="font-bold text-primary disabled:text-muted-foreground"
                  onClick={() => void requestCode()}
                >
                  {cooldown > 0
                    ? isAr
                      ? `إعادة الإرسال بعد ${cooldown}ث`
                      : `Resend in ${cooldown}s`
                    : isAr
                      ? "إعادة إرسال الرمز"
                      : "Resend code"}
                </button>
              </div>
            </form>
          ) : null}

          {step === "done" ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto size-12 text-primary" />
              <h1 className="mt-4 text-2xl font-black">{isAr ? "تم التحقق بنجاح" : "Verified successfully"}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {isAr ? "جاري إعادتك إلى المواعيد…" : "Returning you to appointments…"}
              </p>
            </div>
          ) : null}
        </Card>
      </section>
    </main>
  );
}
