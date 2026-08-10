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
import kaheelLogo from "@/assets/kaheel-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EasyAuthPanel } from "@/components/marketplace/EasyAuthPanel";

export const Route = createFileRoute("/auth")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — كَحيل | Sign in — Kaheel" },
      {
        name: "description",
        content: "تسجيل دخول المستخدمين المصرح لهم في منصة كَحيل لإدارة المشاريع وعهد المشرفين.",
      },
      { property: "og:title", content: "تسجيل الدخول — كَحيل" },
      { property: "og:description", content: "Sign in to Kaheel — internal management system." },
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
  const [mode, setMode] = useState<"code" | "password">("code");
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
      <div className="relative hidden flex-col items-center justify-center gap-4 overflow-hidden bg-[radial-gradient(circle_at_20%_18%,rgb(195_171_255/0.3),transparent_25%),radial-gradient(circle_at_82%_78%,rgb(245_158_11/0.14),transparent_26%),linear-gradient(135deg,#8A4FFF_0%,#C3ABFF_145%)] p-12 lg:flex">
        <img
          src={kaheelLogo}
          alt=""
          width={1024}
          height={1024}
          className="size-20 rounded-[var(--r-card)]"
          aria-hidden
        />
        <span className="text-5xl font-black text-market-navy-foreground">
          {t("market.brand")}
        </span>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] lg:px-10 lg:py-12">
        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col lg:justify-center lg:rounded-[1.75rem] lg:border lg:border-border lg:bg-white lg:p-8 lg:shadow-raised">
          <div className="mb-6 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-xl font-bold text-foreground lg:hidden">
              <img
                src={kaheelLogo}
                alt=""
                width={1024}
                height={1024}
                className="size-8 rounded-lg"
                aria-hidden
              />
              {t("market.brand")}
            </span>
            <div className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary p-1">
              <button
                type="button"
                onClick={() => setLocale("ar")}
                className={
                  locale === "ar"
                    ? "rounded-full bg-primary px-3 py-1 text-desc font-semibold text-primary-foreground"
                    : "rounded-full px-3 py-1 text-desc font-semibold text-muted-foreground"
                }
              >
                العربية
              </button>
              <button
                type="button"
                onClick={() => setLocale("en")}
                className={
                  locale === "en"
                    ? "rounded-full bg-primary px-3 py-1 text-desc font-semibold text-primary-foreground"
                    : "rounded-full px-3 py-1 text-desc font-semibold text-muted-foreground"
                }
              >
                English
              </button>
            </div>
          </div>

          <h1 className="text-page font-bold text-foreground">{t("auth.signIn")}</h1>

          <div className="mt-4 inline-flex w-full items-center gap-1 rounded-full border border-border bg-secondary p-1">
            {(["code", "password"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={
                  mode === value
                    ? "flex-1 rounded-full bg-primary px-3 py-2 text-desc font-bold text-primary-foreground"
                    : "flex-1 rounded-full px-3 py-2 text-desc font-bold text-muted-foreground"
                }
              >
                {value === "code"
                  ? t("market.easyAuth.codeTab")
                  : t("market.easyAuth.passwordTab")}
              </button>
            ))}
          </div>

          {mode === "code" && (
            <div className="mt-5">
              <EasyAuthPanel
                onSignedIn={() => {
                  void landing().then((path) => navigate({ to: path, replace: true }));
                }}
              />
            </div>
          )}

          <form
            onSubmit={onSubmit}
            className={mode === "password" ? "mt-6 space-y-4" : "hidden"}
          >
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

          <div className="mt-5 flex flex-col items-center gap-2 text-desc text-muted-foreground">
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

        <p className="mt-6 text-center text-desc text-muted-foreground">{t("auth.rights")}</p>
      </div>
    </main>
  );
}
