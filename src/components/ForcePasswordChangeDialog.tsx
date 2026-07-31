import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Blocking dialog shown until a first-login user sets their own password. */
export function ForcePasswordChangeDialog() {
  const { t } = useI18n();
  const { profile, refresh } = useSession();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const open = !!profile?.must_change_password;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      toast.error(t("auth.passwordShort"));
      return;
    }
    if (password !== confirm) {
      toast.error(t("auth.passwordMismatch"));
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSaving(false);
      toast.error(t("errors.saveFailed"));
      return;
    }
    await supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("user_id", profile!.user_id);
    await refresh();
    setSaving(false);
    setPassword("");
    setConfirm("");
    toast.success(t("auth.passwordChanged"));
  }

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-md [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("auth.mustChangeTitle")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t("auth.mustChangeDesc")}</p>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="np">{t("auth.newPassword")}</Label>
            <Input
              id="np"
              type="password"
              dir="ltr"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp">{t("auth.confirmPassword")}</Label>
            <Input
              id="cp"
              type="password"
              dir="ltr"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t("common.save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
