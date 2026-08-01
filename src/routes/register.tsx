import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { registerAccount } from "@/lib/register.functions";
import { useI18n } from "@/i18n";
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
          "أنشئ حسابًا في تحقّق لإنشاء مساحة عمل لإدارة المشاريع والمشرفين والعهد أو لقبول دعوة انضمام.",
      },
      { property: "og:title", content: "إنشاء حساب — تحقّق" },
      { property: "og:description", content: "Create your Tahqaq account and workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegisterPage,
});

/** Only same-origin invite tokens are carried through registration. */
function inviteTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("invite");
  return raw && /^[a-f0-9]{16,128}$/i.test(raw) ? raw : null;
}

function RegisterPage() {
  const { t, dir } = useI18n();
  const navigate = useNavigate();
  const submitRegister = useServerFn(registerAccount);

  const [mounted, setMounted] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
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
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

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
      const result = await submitRegister({
        data: {
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          national_id: form.national_id.trim(),
          password: form.password,
          origin: window.location.origin,
          ...(inviteToken ? { invite_token: inviteToken } : {}),
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
      setDone(true);
    } catch {
      toast.error(t("signup.invalid"));
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) return null;

  return (
    <div dir={dir} className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <span className="text-base font-bold text-foreground">{t("app.name")}</span>
        </div>

        {done ? (
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
        ) : (
          <>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">{t("signup.title")}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{t("signup.subtitle")}</p>
            {inviteToken && (
              <p className="mt-3 rounded-lg bg-secondary p-2.5 text-xs text-muted-foreground">
                {t("signup.inviteNote")}
              </p>
            )}

            <form onSubmit={onSubmit} className="mt-5 space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="full_name">{t("signup.fullName")}</Label>
                <Input id="full_name" required value={form.full_name} onChange={set("full_name")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("signup.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  dir="ltr"
                  autoComplete="email"
                  value={form.email}
                  onChange={set("email")}
                />
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
                  minLength={8}
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
                  minLength={8}
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
          </>
        )}
      </div>
    </div>
  );
}
