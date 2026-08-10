import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { passwordPolicyError } from "@/lib/password-policy";

export const Route = createFileRoute("/reset-password")({
  ssr: "data-only",
  head: () => ({
    meta: [{ title: "تعيين كلمة مرور جديدة — كَحيل" }, { name: "robots", content: "noindex" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t, dir } = useI18n();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setReady(Boolean(session));
      setChecking(false);
    });
    void supabase.auth.getSession().then(({ data: sessionData }) => {
      if (!mounted) return;
      setReady(Boolean(sessionData.session));
      setChecking(false);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      toast.error(t("auth.passwordMismatch"));
      return;
    }
    if (passwordPolicyError(password)) {
      toast.error(t("auth.passwordWeak"));
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(t("auth.passwordChanged"));
      await supabase.auth.signOut();
      void navigate({ to: "/auth", replace: true });
    } catch {
      toast.error(t("auth.recoveryFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      dir={dir}
      className="market-surface flex min-h-screen items-center justify-center px-5 py-10"
    >
      <section className="w-full max-w-md rounded-[var(--r-card)] border border-border bg-card p-6 shadow-sm">
        <h1 className="text-page font-bold">{t("auth.resetTitle")}</h1>
        {checking ? (
          <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("auth.recoveryChecking")}
          </div>
        ) : !ready ? (
          <div className="mt-3 space-y-4 text-sm text-muted-foreground">
            <p>{t("auth.recoveryExpired")}</p>
            <Link to="/forgot-password" className="inline-block font-semibold text-primary">
              {t("auth.requestNewRecovery")}
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">{t("auth.newPassword")}</Label>
              <Input
                id="new-password"
                type="password"
                dir="ltr"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t("auth.confirmPassword")}</Label>
              <Input
                id="confirm-password"
                type="password"
                dir="ltr"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <p className="text-desc text-muted-foreground">{t("signup.passwordHint")}</p>
            <Button type="submit" className="h-12 w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {t("auth.updatePassword")}
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}
