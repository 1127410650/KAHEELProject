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
      { title: "إنشاء حساب — تحقّق | Create account — Tahqaq" },
      {
        name: "description",
        content:
          "أنشئ حسابًا فرديًا في تحقّق لاستخدام السوق العام؛ حسابات النظام الداخلي بدعوة من المسؤول.",
      },
      { property: "og:title", content: "إنشاء حساب — تحقّق" },
      {
        property: "og:description",
        content: "Create an individual Tahqaq marketplace account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegisterPage,
});

/** Only same-origin invite tokens are accepted; anything else is treated as absent. */
function inviteTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("invite");
  return raw && /^[a-f0-9]{16,128}$/i.test(raw) ? raw : null;
}

function Shell({ children }: { children: React.ReactNode }) {
  const { t, dir } = useI18n();
  return (
    <div dir={dir} className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
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
      </div>
    </div>
  );
}

function RegisterPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const submitRegister = useServerFn(registerAccount);

  const [mounted, setMounted] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    national_id: "",
    password: "",
    confirm: "",
  });
  const [agreed, setAgreed] = useState(false);
  const inviteToken = mounted ? inviteTokenFromUrl() : null;

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/choose-account", replace: true });
    });
  }, [navigate]);

  // The invitation decides whether any form is shown at all, and which email is used.
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

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function onSubmit(event: React.FormEvent) {
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

  // No invitation: this is the PUBLIC marketplace sign-up (individual account).
  // Internal system accounts still require a live invitation.
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

      <form onSubmit={onSubmit} className="mt-5 space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="full_name">{t("signup.fullName")}</Label>
          <Input id="full_name" required value={form.full_name} onChange={set("full_name")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">{t("signup.phone")}</Label>
          <Input
            id="phone"
            required
            dir="ltr"
            inputMode="tel"
            placeholder="05XXXXXXXX"
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
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("signup.password")}</Label>
          <Input
            id="password"
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
          <Label htmlFor="confirm">{t("signup.confirm")}</Label>
          <Input
            id="confirm"
            type="password"
            required
            minLength={10}
            dir="ltr"
            autoComplete="new-password"
            value={form.confirm}
            onChange={set("confirm")}
          />
        </div>

        <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
          <Checkbox
            checked={agreed}
            onCheckedChange={(v) => setAgreed(v === true)}
            aria-label={t("signup.terms")}
          />
          <span>{t("signup.terms")}</span>
        </label>

        <Button type="submit" className="w-full" disabled={busy || !agreed}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {busy ? t("signup.submitting") : t("signup.submit")}
        </Button>
      </form>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        {t("signup.haveAccount")}{" "}
        <Link to="/auth" className="font-semibold text-primary">
          {t("signup.signIn")}
        </Link>
      </p>
    </Shell>
  );
}


/**
 * Public sign-up: individual marketplace account only.
 * No city, no account-type choice, no role. The country default follows the
 * existing account policy (Saudi Arabia) and is not asked for here.
 */
function PublicSignupForm() {
  const { t } = useI18n();
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
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

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

      // New accounts stay signed in on this device by default.
      setRememberSession(true);
      const session = await signIn({
        data: { identifier: form.email.trim().toLowerCase(), password: form.password },
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
      let landing = "/select-account";
      try {
        landing = await landingPathForSession();
      } catch {
        /* keep the default landing */
      }
      navigate({ to: landing, replace: true });
    } catch {
      toast.error(t("signup.invalid"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <h1 className="text-xl font-bold text-foreground sm:text-2xl">{t("signup.publicTitle")}</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {t("signup.publicSubtitle")}
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="p_full_name">{t("signup.fullName")}</Label>
          <Input id="p_full_name" required value={form.full_name} onChange={set("full_name")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p_email">{t("signup.email")}</Label>
          <Input
            id="p_email"
            type="email"
            required
            dir="ltr"
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
          />
          <p className="text-xs text-muted-foreground">{t("signup.emailHint")}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p_phone">{t("signup.phone")}</Label>
          <Input
            id="p_phone"
            dir="ltr"
            inputMode="tel"
            autoComplete="tel"
            placeholder="05XXXXXXXX"
            value={form.phone}
            onChange={set("phone")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p_password">{t("signup.password")}</Label>
          <Input
            id="p_password"
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
          <Label htmlFor="p_confirm">{t("signup.confirm")}</Label>
          <Input
            id="p_confirm"
            type="password"
            required
            minLength={10}
            dir="ltr"
            autoComplete="new-password"
            value={form.confirm}
            onChange={set("confirm")}
          />
        </div>

        <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
          <Checkbox
            checked={agreed}
            onCheckedChange={(v) => setAgreed(v === true)}
            aria-label={t("signup.terms")}
          />
          <span>{t("signup.terms")}</span>
        </label>

        <Button type="submit" className="w-full" disabled={busy || !agreed}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {busy ? t("signup.submitting") : t("signup.submit")}
        </Button>
      </form>

      <p className="mt-4 rounded-lg bg-secondary p-2.5 text-xs leading-relaxed text-muted-foreground">
        {t("signup.individualNote")}
      </p>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {t("signup.haveAccount")}{" "}
        <Link to="/auth" className="font-semibold text-primary">
          {t("signup.signIn")}
        </Link>
      </p>
    </Shell>
  );
}
