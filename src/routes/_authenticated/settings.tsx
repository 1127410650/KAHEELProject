import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n, type Locale } from "@/i18n";
import { useSession } from "@/lib/session";
import { formatDate, formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات — تحقّق | Settings — Tahqaq" },
      { name: "description", content: "إعدادات النظام العامة وتفضيلات المستخدم في تحقّق." },
      { property: "og:title", content: "الإعدادات — تحقّق" },
      { property: "og:description", content: "System settings and user preferences." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const { profile, refresh } = useSession();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!profile) return;
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), phone: phone.trim() || null, locale })
        .eq("id", profile.id);
      if (error) throw error;
      await refresh();
    },
    onSuccess: () => toast.success(t("settings.profileSaved")),
    onError: () => toast.error(t("errors.saveFailed")),
  });

  return (
    <>
      <PageHeader title={t("settings.title")} description={t("settings.description")} />

      <div className="grid gap-2 sm:gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("settings.myPreferences")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-4">
            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="full_name">{t("users.fullName")}</Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="s_phone">{t("users.phone")}</Label>
              <Input
                id="s_phone"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1 sm:space-y-2">
              <Label>{t("users.locale")}</Label>
              <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">{t("common.arabic")}</SelectItem>
                  <SelectItem value="en">{t("common.english")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-auto max-[359px]:w-full" onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
              {t("common.save")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("settings.general")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border text-[13px] sm:text-sm">
              <div className="flex min-h-[42px] items-center justify-between gap-2 py-1.5 sm:min-h-0 sm:py-3">
                <dt className="text-muted-foreground">{t("settings.currency")}</dt>
                <dd className="num font-medium">SAR</dd>
              </div>
              <div className="flex min-h-[42px] items-center justify-between gap-2 py-1.5 sm:min-h-0 sm:py-3">
                <dt className="text-muted-foreground">{t("settings.timezone")}</dt>
                <dd className="num font-medium">Asia/Riyadh</dd>
              </div>
              <div className="flex min-h-[42px] items-center justify-between gap-2 py-1.5 sm:min-h-0 sm:py-3">
                <dt className="text-muted-foreground">{t("settings.dateFormat")}</dt>
                <dd className="num text-end font-medium" dir="ltr">
                  {formatDateTime(now)}
                </dd>
              </div>
              <div className="flex min-h-[42px] items-center justify-between gap-2 py-1.5 sm:min-h-0 sm:py-3">
                <dt className="text-muted-foreground">{t("settings.datePreview")}</dt>
                <dd className="num text-end font-medium" dir="ltr">
                  {formatDate(now)}
                </dd>
              </div>

              <div className="flex min-h-[42px] items-center justify-between gap-2 py-1.5 sm:min-h-0 sm:py-3">
                <dt className="text-muted-foreground">{t("settings.defaultLocale")}</dt>
                <dd className="font-medium">{t("common.arabic")}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
