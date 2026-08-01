import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "إنشاء مساحة العمل — تحقّق | Create workspace — Tahqaq" },
      {
        name: "description",
        content: "خطوات إنشاء مساحة عمل في تحقّق: نوع الكيان، البيانات الأساسية، ثم المراجعة.",
      },
      { property: "og:title", content: "إنشاء مساحة العمل — تحقّق" },
      { property: "og:description", content: "Set up your Tahqaq workspace in three steps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OnboardingPage,
});

const TENANT_TYPES = [
  "company",
  "establishment",
  "property_owner",
  "project_owner",
  "individual",
  "service_provider",
] as const;
type TenantType = (typeof TENANT_TYPES)[number];

const USAGE_TYPES = ["property", "project", "personal"] as const;

function OnboardingPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [type, setType] = useState<TenantType>("company");
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [form, setForm] = useState({
    name_ar: "",
    name_en: "",
    legal_name: "",
    cr_number: "",
    vat_number: "",
    city: "",
    phone: "",
    email: "",
    activity: "",
    usage_type: "project",
    provider_type: "",
    specialty: "",
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const owned = useQuery({
    queryKey: ["my-owned-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_memberships")
        .select("id")
        .eq("role", "owner")
        .eq("status", "active");
      if (error) throw error;
      return data ?? [];
    },
  });

  const isBusiness = type === "company" || type === "establishment";
  const isProvider = type === "service_provider";
  const isPersonal = type === "individual" || type === "property_owner" || type === "project_owner";

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_workspace", {
        _tenant_type: type,
        _name_ar: form.name_ar.trim(),
        _name_en: form.name_en.trim() || undefined,
        _legal_name: isBusiness ? form.legal_name.trim() || undefined : undefined,
        _cr_number: isBusiness ? form.cr_number.trim() || undefined : undefined,
        _vat_number: form.vat_number.trim() || undefined,
        _city: form.city.trim() || undefined,
        _phone: form.phone.trim() || undefined,
        _email: form.email.trim() || undefined,
        _activity: form.activity.trim() || undefined,
        _usage_type: isPersonal ? form.usage_type : undefined,
        _provider_type: isProvider ? form.provider_type.trim() || undefined : undefined,
        _specialty: isProvider ? form.specialty.trim() || undefined : undefined,
        _confirm_duplicate: confirmDuplicate,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: async (tenantId) => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("tahqaq.active_tenant", tenantId);
      }
      toast.success(t("onboarding.created"));
      await queryClient.invalidateQueries();
      navigate({ to: "/dashboard", replace: true });
    },
    onError: (error: { message?: string }) => {
      const message = error?.message ?? "";
      if (message.includes("WORKSPACE_LIMIT")) toast.error(t("onboarding.limitReached"));
      else if (message.includes("DUPLICATE_ENTITY")) {
        setConfirmDuplicate(false);
        toast.error(t("onboarding.duplicate"));
      } else if (message.includes("RATE_LIMITED")) toast.error(t("signup.rateLimited"));
      else toast.error(t("onboarding.required"));
    },
  });

  const canContinue =
    step === 1 ||
    (step === 2 &&
      form.name_ar.trim().length > 1 &&
      (!isBusiness || form.cr_number.trim().length > 3));

  if (owned.data && owned.data.length > 0) {
    return (
      <div className="page-safe mx-auto max-w-md py-10">
        <div className="surface p-5">
          <Building2 className="size-6 text-primary" aria-hidden />
          <h1 className="mt-3 text-lg font-bold text-foreground">{t("onboarding.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("onboarding.limitReached")}</p>
          <Button className="mt-4 w-full" onClick={() => navigate({ to: "/dashboard" })}>
            {t("invite.goWorkspace")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-safe mx-auto max-w-lg py-4 sm:py-8">
      <h1 className="text-xl font-bold text-foreground sm:text-2xl">{t("onboarding.title")}</h1>
      <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{t("onboarding.subtitle")}</p>

      <div className="mt-4 flex items-center gap-1.5">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-primary" : "bg-secondary"}`}
          />
        ))}
      </div>
      <p className="num mt-2 text-xs text-muted-foreground">
        {t("onboarding.step").replace("{n}", String(step))}
      </p>

      <div className="surface mt-4 space-y-4 p-4 sm:p-5">
        {step === 1 && (
          <>
            <h2 className="text-sm font-semibold text-foreground">{t("onboarding.typeTitle")}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {TENANT_TYPES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={`flex items-center justify-between rounded-xl border p-3 text-start text-sm transition ${
                    type === value
                      ? "border-primary bg-primary/5 font-semibold text-foreground"
                      : "border-border text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  <span>{t(`onboarding.types.${value}`)}</span>
                  {type === value && <Check className="size-4 text-primary" aria-hidden />}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-sm font-semibold text-foreground">{t("onboarding.basicTitle")}</h2>
            <div className="space-y-1.5">
              <Label htmlFor="name_ar">
                {isBusiness ? t("onboarding.nameAr") : t("onboarding.workspaceName")}
              </Label>
              <Input id="name_ar" required value={form.name_ar} onChange={set("name_ar")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name_en">{t("onboarding.nameEn")}</Label>
              <Input id="name_en" dir="ltr" value={form.name_en} onChange={set("name_en")} />
            </div>

            {isBusiness && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="legal_name">{t("onboarding.legalName")}</Label>
                  <Input id="legal_name" value={form.legal_name} onChange={set("legal_name")} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cr_number">{t("onboarding.crNumber")}</Label>
                    <Input
                      id="cr_number"
                      dir="ltr"
                      inputMode="numeric"
                      value={form.cr_number}
                      onChange={set("cr_number")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="vat_number">{t("onboarding.vatNumber")}</Label>
                    <Input
                      id="vat_number"
                      dir="ltr"
                      inputMode="numeric"
                      value={form.vat_number}
                      onChange={set("vat_number")}
                    />
                  </div>
                </div>
              </>
            )}

            {isPersonal && (
              <div className="space-y-1.5">
                <Label>{t("onboarding.usageTitle")}</Label>
                <Select
                  value={form.usage_type}
                  onValueChange={(value) => setForm((p) => ({ ...p, usage_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {USAGE_TYPES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`onboarding.usage.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isProvider && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="provider_type">{t("onboarding.providerType")}</Label>
                  <Input
                    id="provider_type"
                    value={form.provider_type}
                    onChange={set("provider_type")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="specialty">{t("onboarding.specialty")}</Label>
                  <Input id="specialty" value={form.specialty} onChange={set("specialty")} />
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="city">{t("onboarding.city")}</Label>
                <Input id="city" value={form.city} onChange={set("city")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">{t("onboarding.phone")}</Label>
                <Input
                  id="phone"
                  dir="ltr"
                  inputMode="tel"
                  value={form.phone}
                  onChange={set("phone")}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("onboarding.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  dir="ltr"
                  value={form.email}
                  onChange={set("email")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="activity">{t("onboarding.activity")}</Label>
                <Input id="activity" value={form.activity} onChange={set("activity")} />
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-sm font-semibold text-foreground">{t("onboarding.reviewTitle")}</h2>
            <dl className="space-y-2 text-sm">
              <Row label={t("onboarding.typeTitle")} value={t(`onboarding.types.${type}`)} />
              <Row label={t("onboarding.name")} value={form.name_ar} />
              {isBusiness && (
                <>
                  <Row label={t("onboarding.crNumber")} value={form.cr_number} numeric />
                  <Row label={t("onboarding.vatNumber")} value={form.vat_number} numeric />
                </>
              )}
              {isPersonal && (
                <Row
                  label={t("onboarding.usageTitle")}
                  value={t(`onboarding.usage.${form.usage_type}`)}
                />
              )}
              {isProvider && (
                <>
                  <Row label={t("onboarding.providerType")} value={form.provider_type} />
                  <Row label={t("onboarding.specialty")} value={form.specialty} />
                </>
              )}
              <Row label={t("onboarding.city")} value={form.city} />
              <Row label={t("onboarding.phone")} value={form.phone} numeric />
              <Row label={t("onboarding.email")} value={form.email} />
            </dl>

            <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
              <Checkbox
                checked={confirmDuplicate}
                onCheckedChange={(v) => setConfirmDuplicate(v === true)}
                aria-label={t("onboarding.duplicateConfirm")}
              />
              <span>{t("onboarding.duplicateConfirm")}</span>
            </label>
          </>
        )}

        <div className="flex items-center gap-2 pt-1">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
              {t("onboarding.back")}
            </Button>
          )}
          {step < 3 ? (
            <Button className="flex-1" disabled={!canContinue} onClick={() => setStep((s) => s + 1)}>
              {t("onboarding.next")}
            </Button>
          ) : (
            <Button className="flex-1" disabled={create.isPending} onClick={() => create.mutate()}>
              {create.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {create.isPending ? t("onboarding.creating") : t("onboarding.create")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  numeric,
}: {
  label: string;
  value: string;
  numeric?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={`wrap-anywhere text-end font-medium text-foreground ${numeric ? "num" : ""}`}
        dir={numeric ? "ltr" : undefined}
      >
        {value || "—"}
      </dd>
    </div>
  );
}
