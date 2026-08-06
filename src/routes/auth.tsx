import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { rememberSession, setRememberSession } from "@/lib/auth-storage";
import { landingPathForSession } from "@/lib/mkt-platform";
import { signInWithIdentifier } from "@/lib/auth.functions";
import { safeInternalPath } from "@/lib/mkt";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — كحلي | Sign in — Kahli" },
      {
        name: "description",
        content: "تسجيل دخول المستخدمين المصرح لهم في منصة كحلي لإدارة المشاريع وعهد المشرفين.",
      },
      { property: "og:title", content: "تسجيل الدخول — كحلي" },
      { property: "og:description", content: "Sign in to Kahli — internal management system." },
    ],
  }),
  component: AuthPage,
});

/** Only allow same-origin internal paths, so a crafted link cannot redirect off-site. */
function safeNext(): string | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("next");
  return safeInternalPath(raw);
}

function AuthPage() {
  const { t, locale, setLocale, dir } = useI18n();
  const navigate = useNavigate();
  const signIn = useServerFn(signInWithIdentifier);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Enabled by default; the scope only changes WHERE Supabase keeps its own
  // session entry (see `@/lib/auth-storage`).
  const [remember, setRemember] = useState(true);
  // The route is client-only; matching the empty server shell on the first paint
  // avoids a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    setRemember(rememberSession());
  }, []);

  // Where to land is decided by the server-side platform role, never by the
  // signed-in email address: a platform admin lands in the console directly.
  async function landing(): Promise<string> {
    const next = safeNext();
    if (next) return next;
    try {
      return await landingPathForSession();
    } catch {
      return "/";
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) navigate({ to: await landing(), replace: true });
    });
  }, [navigate]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      // Decide the persistence scope BEFORE the session is written.
      setRememberSession(remember);
      const result = await signIn({ data: { identifier: identifier.trim(), password } });
      if (!result.ok || !result.access_token || !result.refresh_token) {
        toast.error(result.error === "LOCKED" ? t("auth.locked") : t("auth.invalid"));
        return;
      }
      const { error } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
      if (error) {
        toast.error(t("auth.invalid"));
        return;
      }
      navigate({ to: await landing(), replace: true });
    } catch {
      toast.error(t("auth.invalid"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!mounted) return null;

  return (
    <div dir={dir} className="market-surface flex min-h-screen flex-col lg:grid lg:grid-cols-2">
      {/* Desktop-only brand panel: the platform name and nothing else. */}
      <div className="relative hidden flex-col items-center justify-center bg-market-navy p-12 lg:flex">
        <span className="text-4xl font-bold tracking-tight text-market-navy-foreground">
          {t("market.brand")}
        </span>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] lg:px-10 lg:py-12">
        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col lg:justify-center">
          <div className="mb-6 flex items-center justify-between gap-3">
            <span className="text-xl font-bold tracking-tight text-foreground lg:hidden">
              {t("market.brand")}
            </span>
            <div className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary p-1">
              <button
                type="button"
                onClick={() => setLocale("ar")}
                className={
                  locale === "ar"
                    ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                    : "rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground"
                }
              >
                العربية
              </button>
              <button
                type="button"
                onClick={() => setLocale("en")}
                className={
                  locale === "en"
                    ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                    : "rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground"
                }
              >
                English
              </button>
            </div>
          </div>

          <h1 className="text-xl font-bold text-foreground">{t("auth.signIn")}</h1>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">{t("auth.identifier")}</Label>
              <Input
                id="identifier"
                required
                dir="ltr"
                autoComplete="username"
                className="h-12"
                placeholder={t("auth.identifierHint")}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                type="password"
                required
                dir="ltr"
                autoComplete="current-password"
                className="h-12"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <label className="flex items-center gap-2.5 text-sm text-foreground">
              <Checkbox
                checked={remember}
                onCheckedChange={(v) => setRemember(v === true)}
                aria-label={t("auth.remember")}
              />
              <span className="min-w-0">{t("auth.remember")}</span>
            </label>

            <Button type="submit" className="h-12 w-full" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {submitting ? t("auth.signingIn") : t("auth.signIn")}
            </Button>
          </form>

          <div className="mt-5 flex flex-col items-center gap-2 text-xs text-muted-foreground">
            <Link
              to="/forgot-password"
              className="font-semibold text-muted-foreground underline hover:text-primary"
            >
              {t("auth.forgot")}
            </Link>
            <p>
              {t("auth.noAccount")}{" "}
              <Link to="/register" className="font-semibold text-primary">
                {t("auth.createAccount")}
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">{t("auth.rights")}</p>
      </div>
    </div>
  );
}
