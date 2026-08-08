import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { enablePersistentSession } from "@/lib/auth-storage";
import { landingPathForSession } from "@/lib/mkt-platform";
import { signInWithIdentifier } from "@/lib/auth.functions";
import { safeInternalPath } from "@/lib/mkt";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — گحيل | Sign in — Gohail" },
      {
        name: "description",
        content: "تسجيل دخول المستخدمين المصرح لهم في منصة گحيل لإدارة المشاريع وعهد المشرفين.",
      },
      { property: "og:title", content: "تسجيل الدخول — گحيل" },
      { property: "og:description", content: "Sign in to Gohail — internal management system." },
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
  // The route is client-only; matching the empty server shell on the first paint
  // avoids a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    // Marketplace sessions are durable by design for both personal and store
    // identities. They end only through explicit sign-out or security revocation.
    enablePersistentSession();
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
      // Persist the one official Supabase session before it is written.
      enablePersistentSession();
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
    <main
      dir={dir}
      className="market-surface flex min-h-screen flex-col bg-background lg:grid lg:grid-cols-2"
    >
      {/* Desktop-only brand panel: the platform name and nothing else. */}
      <div className="relative hidden flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_20%_18%,rgb(84_160_255/0.3),transparent_25%),radial-gradient(circle_at_82%_78%,rgb(245_158_11/0.16),transparent_26%),linear-gradient(135deg,#07152f_0%,#0b1d43_48%,#0b5cc5_145%)] p-12 lg:flex">
        <span className="text-5xl font-black tracking-[-0.08em] text-market-navy-foreground">
          {t("market.brand")}
        </span>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] lg:px-10 lg:py-12">
        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col lg:justify-center lg:rounded-[1.75rem] lg:border lg:border-border lg:bg-white lg:p-8 lg:shadow-raised">
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
    </main>
  );
}
