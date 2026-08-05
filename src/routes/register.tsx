import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { registerAccount } from "@/lib/register.functions";
import { signUpPublic } from "@/lib/signup.functions";
import { signInWithIdentifier } from "@/lib/auth.functions";
import { landingPathForSession } from "@/lib/mkt-platform";
import { setRememberSession } from "@/lib/auth-storage";
import { useI18n } from "@/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/register")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "إنشاء حساب سوري — كحلي | Create account — Kahli" },
      {
        name: "description",
        content: "أنشئ حسابًا فرديًا في نسخة كحلي السورية باستخدام اسمك ورقم جوالك السوري.",
      },
      { property: "og:title", content: "إنشاء حساب سوري — كحلي" },
      { property: "og:description", content: "Create an individual account in Kahli's Syria marketplace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegisterPage,
});

function inviteTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("invite");
  return raw && /^[a-f0-9]{16,128}$/i.test(raw) ? raw : null;
}

function Shell({ children }: { children: React.ReactNode }) {
  const { t, dir } = useI18n();
  return (
    <div
      dir={dir}
      className="market-surface flex min-h-screen flex-col px-5 pb-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] sm:items-center sm:justify-center sm:py-10"
    >
      <div className="mx-auto w-full max-w-[440px]">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <span className="text-base font-bold text-foreground">{t("app.name")}</span>
          <span className="ms-auto">
            <LanguageToggle compact />
          </span>
        </div>
        {children}
        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          {t("market.footer.rights")}
        </p>
      </div>
    </div>
  );
}

function RegisterPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const submitRegister = useServerFn(registerAccount);
  const [mounted, setMounted] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    national_id: "",
    password: "",
    confirm: "",
  });
  const inviteToken = mounted ? inviteTokenFromUrl() : null;
  const nameLabel = locale === "ar" ? "الاسم" : "Name";

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  const preview = useQuery({
    queryKey: ["invite-preview", inviteToken],
    enabled: !!inviteToken,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("invitation_preview", { _token: inviteToken! });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as
        | { state: string; masked_email: string | null }
        | undefined;
      return row ?? { state: "invalid", masked_email: null };
    },
  });

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((previous) => ({ ...previous, [key]: event.target.value }));

  async function onInviteSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!inviteToken) return;
    if (form.password !== form.confirm) {
      toast.error(t("signup.mismatch"));
      return;
    }
    setBusy(true);
    try {
      const result = await submitRegister({
        data: {
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          national_id: form.national_id.trim(),
          password: form.password,
          origin: window.location.origin,
          invite_token: inviteToken,
        },
      });
      if (!result.ok) {
        toast.error(
          result.error === "RATE_LIMITED"
            ? t("signup.rateLimited")
            : result.error === "WEAK_PASSWORD"
              ? t("signup.weakPassword")
              : result.error === "INVITE_REQUIRED" || result.error === "INVITE_INVALID"
                ? t("signup.inviteRequiredBody")
                : t("signup.invalid"),
        );
        return;
      }
      setDone(true);
    } catch {
      toast.error(t("signup.invalid"));
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) return null;

  if (!inviteToken || (preview.isSuccess && preview.data.state !== "valid") || preview.isError) {
    return <PublicSignupForm />;
  }

  if (preview.isLoading) {
    return (
      <Shell>
        <div className="surface flex items-center gap-2 p-5 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("common.loading")}
        </div>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="surface p-5">
          <MailCheck className="size-6 text-primary" aria-hidden />
          <h1 className="mt-3 text-lg font-bold text-foreground">{t("signup.checkEmail")}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t("signup.checkEmailBody")}
          </p>
          <Button asChild className="mt-4 w-full">
            <Link to="/auth">{t("signup.signIn")}</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-xl font-bold text-foreground sm:text-2xl">{t("signup.title")}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{t("signup.inviteOnlySubtitle")}</p>
      <p className="mt-3 rounded-lg bg-secondary p-2.5 text-xs text-muted-foreground">
        {t("signup.inviteNote")}{" "}
        <span dir="ltr" className="font-semibold text-foreground">
          {preview.data?.masked_email ?? ""}
        </span>
      </p>
      <p className="mt-2 rounded-lg border border-primary/15 bg-primary/5 p-2.5 text-xs font-semibold text-primary">
        نسخة سوريا فقط — استخدم رقم جوال سوري يبدأ بـ 09 أو +9639.
      </p>

      <form onSubmit={onInviteSubmit} className="mt-5 space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="full_name">{nameLabel}</Label>
          <Input id="full_name" required value={form.full_name} onChange={set("full_name")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">{t("signup.phone")}</Label>
          <Input
            id="phone"
            required
            dir="ltr"
            inputMode="tel"
            placeholder="+9639XXXXXXXX"
            value={form.phone}
            onChange={set("phone")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="national_id">{t("signup.nationalId")}</Label>
          <Input
            id="national_id"
            dir="ltr"
            inputMode="numeric"
            value={form.national_id}
            onChange={set("national_id")}
          />
        </div>
        <PasswordFields form={form} set={set} />
        <Terms checked={agreed} onChange={setAgreed} label={t("signup.terms")} />
        <Button type="submit" className="w-full" disabled={busy || !agreed}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {busy ? t("signup.submitting") : t("signup.submit")}
        </Button>
      </form>

      <SignInLink />
    </Shell>
  );
}

function PublicSignupForm() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const submitSignup = useServerFn(signUpPublic);
  const signIn = useServerFn(signInWithIdentifier);
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((previous) => ({ ...previous, [key]: event.target.value }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (form.password !== form.confirm) {
      toast.error(t("signup.mismatch"));
      return;
    }
    setBusy(true);
    try {
      const result = await submitSignup({
        data: {
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
        },
      });
      if (!result.ok) {
        toast.error(
          result.error === "RATE_LIMITED"
            ? t("signup.rateLimited")
            : result.error === "WEAK_PASSWORD"
              ? t("signup.weakPassword")
              : t("signup.invalid"),
        );
        return;
      }

      setRememberSession(true);
      const session = await signIn({
        data: { identifier: form.phone.trim(), password: form.password },
      });
      if (!session.ok || !session.access_token || !session.refresh_token) {
        toast.info(t("signup.signInFailed"));
        navigate({ to: "/auth", replace: true });
        return;
      }
      const { error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (error) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      toast.success(t("signup.created"));
      let landing = "/more";
      try {
        landing = await landingPathForSession();
      } catch {
        /* keep the completion-aware fallback */
      }
      navigate({ to: landing, replace: true });
    } catch {
      toast.error(t("signup.invalid"));
    } finally {
      setBusy(false);
    }
  }

  const nameLabel = locale === "ar" ? "الاسم" : "Name";
  const optionalEmailLabel = locale === "ar" ? "البريد الإلكتروني (اختياري)" : "Email (optional)";
  const emailNote =
    locale === "ar"
      ? "ليصلك كل جديد أضف بريدك الإلكتروني. يمكنك التحقق منه لاحقًا من حسابك."
      : "Add your email to receive updates. You can verify it later from your account.";
  const phoneNote =
    locale === "ar"
      ? "استخدم رقمًا سوريًا يبدأ بـ 09 أو +9639. سيُحفظ كمعرّف دخول دون إرسال رسالة SMS."
      : "Use a Syrian mobile starting with 09 or +9639. It is stored as your sign-in ID without an SMS.";

  return (
    <Shell>
      <h1 className="text-xl font-bold text-foreground sm:text-2xl">{t("signup.publicTitle")}</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {t("signup.publicSubtitle")}
      </p>
      <p className="mt-3 rounded-lg border border-primary/15 bg-primary/5 p-2.5 text-xs font-semibold text-primary">
        {locale === "ar" ? "التسجيل متاح حاليًا لسوريا فقط." : "Registration is currently available for Syria only."}
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="p_full_name">{nameLabel}</Label>
          <Input id="p_full_name" required value={form.full_name} onChange={set("full_name")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="p_phone">{t("signup.phone")}</Label>
          <Input
            id="p_phone"
            required
            dir="ltr"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+9639XXXXXXXX"
            value={form.phone}
            onChange={set("phone")}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">{phoneNote}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="p_email">{optionalEmailLabel}</Label>
          <Input
            id="p_email"
            type="email"
            dir="ltr"
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">{emailNote}</p>
        </div>

        <PasswordFields form={form} set={set} />
        <Terms checked={agreed} onChange={setAgreed} label={t("signup.terms")} />

        <Button type="submit" className="w-full" disabled={busy || !agreed}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {busy ? t("signup.submitting") : t("signup.submit")}
        </Button>
      </form>

      <p className="mt-4 rounded-lg bg-secondary p-2.5 text-xs leading-relaxed text-muted-foreground">
        {t("signup.individualNote")}
      </p>
      <SignInLink />
    </Shell>
  );
}

function PasswordFields({
  form,
  set,
}: {
  form: { password: string; confirm: string };
  set: (key: "password" | "confirm") => (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="password_shared">{t("signup.password")}</Label>
        <Input
          id="password_shared"
          type="password"
          required
          minLength={10}
          dir="ltr"
          autoComplete="new-password"
          value={form.password}
          onChange={set("password")}
        />
        <p className="text-xs text-muted-foreground">{t("signup.passwordHint")}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm_shared">{t("signup.confirm")}</Label>
        <Input
          id="confirm_shared"
          type="password"
          required
          minLength={10}
          dir="ltr"
          autoComplete="new-password"
          value={form.confirm}
          onChange={set("confirm")}
        />
      </div>
    </>
  );
}

function Terms({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        aria-label={label}
      />
      <span>{label}</span>
    </label>
  );
}

function SignInLink() {
  const { t } = useI18n();
  return (
    <p className="mt-5 text-center text-xs text-muted-foreground">
      {t("signup.haveAccount")}{" "}
      <Link to="/auth" className="font-semibold text-primary">
        {t("signup.signIn")}
      </Link>
    </p>
  );
}
