import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  ssr: "data-only",
  head: () => ({
    meta: [{ title: "استعادة كلمة المرور — گحيل" }, { name: "robots", content: "noindex" }],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t, dir } = useI18n();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
      // Keep the response identical whether the address exists or not.
      setSent(true);
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
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-bold">{t("auth.recoveryTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {sent ? t("auth.recoverySent") : t("auth.recoveryDescription")}
        </p>
        {!sent && (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recovery-email">{t("auth.email")}</Label>
              <Input
                id="recovery-email"
                type="email"
                dir="ltr"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <Button type="submit" className="h-12 w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {t("auth.sendRecovery")}
            </Button>
          </form>
        )}
        <Link to="/auth" className="mt-5 block text-center text-sm font-semibold text-primary">
          {t("auth.backToSignIn")}
        </Link>
      </section>
    </main>
  );
}
