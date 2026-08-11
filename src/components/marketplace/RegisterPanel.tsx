/**
 * The one account-creation form of the platform.
 *
 * It used to live inside the `/register` route; `/register` now redirects to
 * `/auth?tab=register` and this panel is rendered inside the single canonical
 * auth screen, so there is exactly one sign-up surface. Both variants it always
 * had are preserved:
 *  - invite variant  (an `invite` token in the URL → `registerAccount`),
 *  - public variant  (ordinary individual account → `signUpPublic`).
 */
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { registerAccount } from "@/lib/register.functions";
import { signUpPublic } from "@/lib/signup.functions";
import { signInWithIdentifier } from "@/lib/auth.functions";
import { landingPathForSession } from "@/lib/mkt-platform";
import { enablePersistentSession } from "@/lib/auth-storage";
import { useI18n } from "@/i18n";
import { DEFAULT_DIAL, normalizePhone } from "@/lib/phone-normalize";
import { DialPhoneField } from "@/components/marketplace/DialPhoneField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export function RegisterPanel({ inviteToken }: { inviteToken: string | null }) {
  const { t } = useI18n();

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

  if (!inviteToken || (preview.isSuccess && preview.data.state !== "valid") || preview.isError) {
    return <PublicSignupForm />;
  }

  if (preview.isLoading) {
    return (
      <div className="surface flex items-center gap-2 p-5 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t("common.loading")}
      </div>
    );
  }

  return (
    <InviteSignupForm inviteToken={inviteToken} maskedEmail={preview.data?.masked_email ?? ""} />
  );
}

function InviteSignupForm({
  inviteToken,
  maskedEmail,
}: {
  inviteToken: string;
  maskedEmail: string;
}) {
  const { t, locale } = useI18n();
  const submitRegister = useServerFn(registerAccount);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [dial, setDial] = useState(DEFAULT_DIAL);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    national_id: "",
    password: "",
    confirm: "",
  });
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((previous) => ({ ...previous, [key]: event.target.value }));
  const nameLabel = locale === "ar" ? "الاسم" : "Name";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (form.password !== form.confirm) {
      toast.error(t("signup.mismatch"));
      return;
    }
    const phone = normalizePhone(dial, form.phone);
    if (!phone) {
      toast.error(t("signup.phoneInvalid"));
      return;
    }
    setBusy(true);
    try {
      const result = await submitRegister({
        data: {
          full_name: form.full_name.trim(),
          phone,
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

  if (done) {
    return (
      <div className="surface p-5">
        <MailCheck className="size-6 text-primary" aria-hidden />
        <h2 className="text-page mt-3 font-bold text-foreground">{t("signup.checkEmail")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("signup.checkEmailBody")}
        </p>
        <Button asChild className="mt-4 w-full">
          <Link to="/auth">{t("signup.signIn")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground">{t("signup.inviteOnlySubtitle")}</p>
      <p className="mt-2 rounded-lg border border-primary/15 bg-primary/5 p-[var(--sp-3)] text-desc font-semibold text-primary">
        {t("signup.adsSyriaOnly")}
      </p>
      <p className="mt-3 rounded-lg bg-secondary p-[var(--sp-3)] text-desc text-muted-foreground">
        {t("signup.inviteNote")}{" "}
        <span dir="ltr" className="font-semibold text-foreground">
          {maskedEmail}
        </span>
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-[var(--sp-4)]">
        <div className="space-y-[var(--sp-2)]">
          <Label htmlFor="reg_full_name">{nameLabel}</Label>
          <Input id="reg_full_name" required value={form.full_name} onChange={set("full_name")} />
        </div>
        <DialPhoneField
          id="reg_phone"
          dial={dial}
          onDialChange={setDial}
          value={form.phone}
          onChange={(value) => setForm((previous) => ({ ...previous, phone: value }))}
          required
        />
        <div className="space-y-[var(--sp-2)]">
          <Label htmlFor="reg_national_id">{t("signup.nationalId")}</Label>
          <Input
            id="reg_national_id"
            dir="ltr"
            inputMode="numeric"
            value={form.national_id}
            onChange={set("national_id")}
          />
        </div>
        <PasswordFields form={form} set={set} />
        <Terms checked={agreed} onChange={setAgreed} label={t("signup.terms")} />
        <Button type="submit" className="h-12 w-full" disabled={busy || !agreed}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {busy ? t("signup.submitting") : t("signup.submit")}
        </Button>
      </form>
    </div>
  );
}

function PublicSignupForm() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const submitSignup = useServerFn(signUpPublic);
  const signIn = useServerFn(signInWithIdentifier);
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [dial, setDial] = useState(DEFAULT_DIAL);
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
    const phone = normalizePhone(dial, form.phone);
    if (!phone) {
      toast.error(t("signup.phoneInvalid"));
      return;
    }
    setBusy(true);
    try {
      const result = await submitSignup({
        data: {
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone,
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

      enablePersistentSession();
      const session = await signIn({ data: { identifier: phone, password: form.password } });
      if (!session.ok || !session.access_token || !session.refresh_token) {
        toast.info(t("signup.signInFailed"));
        return;
      }
      const { error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (error) return;
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
      ? "اكتب رقمك مع الصفر أو بدونه — نُصلّح الصيغة تلقائيًا. يُحفظ كمعرّف دخول دون رسالة SMS."
      : "Type your number with or without the leading zero — we normalise it. Stored as your sign-in ID, no SMS.";

  return (
    <div>
      <p className="text-sm leading-relaxed text-muted-foreground">{t("signup.publicSubtitle")}</p>
      <p className="mt-3 rounded-lg border border-primary/15 bg-primary/5 p-[var(--sp-3)] text-desc font-semibold text-primary">
        {t("signup.adsSyriaOnly")}
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-[var(--sp-4)]">
        <div className="space-y-[var(--sp-2)]">
          <Label htmlFor="p_full_name">{nameLabel}</Label>
          <Input id="p_full_name" required value={form.full_name} onChange={set("full_name")} />
        </div>

        <DialPhoneField
          id="p_phone"
          dial={dial}
          onDialChange={setDial}
          value={form.phone}
          onChange={(value) => setForm((previous) => ({ ...previous, phone: value }))}
          note={phoneNote}
          required
        />

        <div className="space-y-[var(--sp-2)]">
          <Label htmlFor="p_email">{optionalEmailLabel}</Label>
          <Input
            id="p_email"
            type="email"
            dir="ltr"
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
          />
          <p className="text-desc leading-relaxed text-muted-foreground">{emailNote}</p>
        </div>

        <PasswordFields form={form} set={set} />
        <Terms checked={agreed} onChange={setAgreed} label={t("signup.terms")} />

        <Button type="submit" className="h-12 w-full" disabled={busy || !agreed}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {busy ? t("signup.submitting") : t("signup.submit")}
        </Button>
      </form>

      <p className="mt-4 rounded-lg bg-secondary p-[var(--sp-3)] text-desc leading-relaxed text-muted-foreground">
        {t("signup.individualNote")}
      </p>
    </div>
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
      <div className="space-y-[var(--sp-2)]">
        <Label htmlFor="password_shared">{t("signup.password")}</Label>
        <Input
          id="password_shared"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          dir="ltr"
          autoComplete="new-password"
          value={form.password}
          onChange={set("password")}
        />
        <p className="text-desc text-muted-foreground">{t("signup.passwordHint")}</p>
      </div>
      <div className="space-y-[var(--sp-2)]">
        <Label htmlFor="confirm_shared">{t("signup.confirm")}</Label>
        <Input
          id="confirm_shared"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
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
    <label className="flex items-start gap-[var(--sp-3)] text-desc leading-relaxed text-muted-foreground">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        aria-label={label}
      />
      <span>{label}</span>
    </label>
  );
}
