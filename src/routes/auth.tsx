import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { signInWithIdentifier } from "@/lib/auth.functions";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — تحقّق | Sign in — Tahqaq" },
      {
        name: "description",
        content: "تسجيل دخول المستخدمين المصرح لهم في نظام تحقّق لإدارة المشاريع وعهد المشرفين.",
      },
      { property: "og:title", content: "تسجيل الدخول — تحقّق" },
      { property: "og:description", content: "Sign in to Tahqaq — internal management system." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t, locale, setLocale, dir } = useI18n();
  const navigate = useNavigate();
  const signIn = useServerFn(signInWithIdentifier);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
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
      navigate({ to: "/dashboard", replace: true });
    } catch {
      toast.error(t("auth.invalid"));
    } finally {
      setSubmitting(false);
    }
  }


  return (
    <div dir={dir} className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <span className="text-lg font-bold text-sidebar-foreground">{t("app.name")}</span>
        </div>
        <div>
          <h2 className="text-3xl font-bold leading-snug text-sidebar-foreground">
            {t("auth.welcome")}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-sidebar-foreground/70">
            {t("app.tagline")}
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">Asia/Riyadh · SAR · DD/MM/YYYY</p>
      </div>

      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground lg:hidden">
              <ShieldCheck className="size-5" aria-hidden />
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

          <h1 className="text-2xl font-bold text-foreground">{t("auth.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("auth.subtitle")}</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">{t("auth.identifier")}</Label>
              <Input
                id="identifier"
                required
                dir="ltr"
                autoComplete="username"
                placeholder={t("auth.identifierHint")}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t("auth.identifierHint")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                type="password"
                required
                dir="ltr"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {submitting ? t("auth.signingIn") : t("auth.signIn")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
