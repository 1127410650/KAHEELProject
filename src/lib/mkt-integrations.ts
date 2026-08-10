/**
 * سجل الاشتراكات العالمية — طبقة البيانات.
 *
 * السجل يعرّف الخدمات الخارجية المسموح بها فقط: لكل نوع محوّل مزوّد أو اثنان
 * مُعتمدان، وإعداد نقطة النهاية مكتوب في الكود لا في القاعدة. لا يمكن إضافة
 * نقطة نهاية حرة، ولا يُخزَّن أي سر هنا — الاسم فقط، والقيمة في أسرار المشروع.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type AdapterKind = "image_generate" | "image_enhance" | "text_generate" | "translate";

export const ADAPTERS: { kind: AdapterKind; label_ar: string; hint_ar: string }[] = [
  { kind: "image_generate", label_ar: "توليد صور", hint_ar: "إنشاء صورة جديدة من وصف نصي." },
  { kind: "image_enhance", label_ar: "تحسين صور", hint_ar: "تكبير وتوضيح صورة قائمة (النصاعة)." },
  { kind: "text_generate", label_ar: "توليد نصوص", hint_ar: "صياغة عناوين ووصوف قصيرة." },
  { kind: "translate", label_ar: "ترجمة", hint_ar: "ترجمة نصوص الواجهة والإعلانات." },
];

export interface ProviderPreset {
  provider: string;
  label_ar: string;
  adapter: AdapterKind;
  /** اسم السر في إعدادات المشروع — لا قيمته أبدًا. */
  secret_name: string;
  signup_url: string;
  unit_cost_usd: number;
  unit_ar: string;
}

/** المزوّدون المعتمدون — لا يمكن إضافة خدمة خارج هذه القائمة. */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    provider: "lovable-ai-gateway",
    label_ar: "بوابة Lovable AI",
    adapter: "image_generate",
    secret_name: "LOVABLE_API_KEY",
    signup_url: "https://docs.lovable.dev/features/ai",
    unit_cost_usd: 0.02,
    unit_ar: "لكل صورة",
  },
  {
    provider: "openai-gpt-image",
    label_ar: "OpenAI — صور",
    adapter: "image_generate",
    secret_name: "OPENAI_API_KEY",
    signup_url: "https://platform.openai.com/api-keys",
    unit_cost_usd: 0.04,
    unit_ar: "لكل صورة",
  },
  {
    provider: "replicate-real-esrgan",
    label_ar: "Replicate — Real-ESRGAN",
    adapter: "image_enhance",
    secret_name: "IMAGE_ENHANCE_API_KEY",
    signup_url: "https://replicate.com/account/api-tokens",
    unit_cost_usd: 0.0025,
    unit_ar: "لكل صورة",
  },
  {
    provider: "lovable-ai-gateway-text",
    label_ar: "بوابة Lovable AI — نصوص",
    adapter: "text_generate",
    secret_name: "LOVABLE_API_KEY",
    signup_url: "https://docs.lovable.dev/features/ai",
    unit_cost_usd: 0.0008,
    unit_ar: "لكل ألف حرف",
  },
  {
    provider: "lovable-ai-gateway-translate",
    label_ar: "بوابة Lovable AI — ترجمة",
    adapter: "translate",
    secret_name: "LOVABLE_API_KEY",
    signup_url: "https://docs.lovable.dev/features/ai",
    unit_cost_usd: 0.0006,
    unit_ar: "لكل ألف حرف",
  },
];

export function presetsFor(adapter: AdapterKind): ProviderPreset[] {
  return PROVIDER_PRESETS.filter((p) => p.adapter === adapter);
}

export function presetOf(provider: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.provider === provider);
}

export interface IntegrationRow {
  id: string;
  code: string;
  adapter: AdapterKind;
  provider: string;
  name_ar: string;
  secret_name: string | null;
  signup_url: string | null;
  unit_cost_usd: number;
  enabled: boolean;
  monthly_cap_usd: number;
  updated_at: string;
}

export const INTEGRATIONS_QUERY_KEY = ["mkt", "platform-integrations"] as const;

export async function fetchIntegrations(): Promise<IntegrationRow[]> {
  const { data, error } = await supabase
    .from("mkt_platform_integrations")
    .select("id, code, adapter, provider, name_ar, secret_name, signup_url, unit_cost_usd, enabled, monthly_cap_usd, updated_at")
    .order("adapter", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as IntegrationRow[];
}

export function useIntegrations() {
  return useQuery({ queryKey: INTEGRATIONS_QUERY_KEY, queryFn: fetchIntegrations, staleTime: 30_000 });
}

export async function addIntegration(input: { provider: string; name_ar: string }): Promise<void> {
  const preset = presetOf(input.provider);
  if (!preset) throw new Error("unknown_provider");
  const code = `${preset.adapter}.${preset.provider}`;
  const { error } = await supabase.from("mkt_platform_integrations").insert({
    code,
    adapter: preset.adapter,
    provider: preset.provider,
    name_ar: input.name_ar.replace(/[<>]/g, "").slice(0, 60) || preset.label_ar,
    secret_name: preset.secret_name,
    signup_url: preset.signup_url,
    unit_cost_usd: preset.unit_cost_usd,
  });
  if (error) throw error;
}

export async function updateIntegration(
  id: string,
  patch: { enabled?: boolean; monthly_cap_usd?: number },
): Promise<void> {
  const next: { enabled?: boolean; monthly_cap_usd?: number } = {};
  if (typeof patch.enabled === "boolean") next.enabled = patch.enabled;
  if (typeof patch.monthly_cap_usd === "number") {
    next.monthly_cap_usd = Math.min(5000, Math.max(0, Math.round(patch.monthly_cap_usd * 100) / 100));
  }
  if (Object.keys(next).length === 0) return;
  const { error } = await supabase.from("mkt_platform_integrations").update(next).eq("id", id);
  if (error) throw error;
}

export function useIntegrationMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: INTEGRATIONS_QUERY_KEY });
  };
  return {
    add: useMutation({ mutationFn: addIntegration, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: (input: { id: string; patch: { enabled?: boolean; monthly_cap_usd?: number } }) =>
        updateIntegration(input.id, input.patch),
      onSuccess: invalidate,
    }),
  };
}

/** استهلاك الشهر الحالي لكل خدمة من سجل `mkt_ai_usage`. */
export interface IntegrationUsage {
  service: string;
  count: number;
  spent_usd: number;
}

export async function fetchIntegrationUsage(): Promise<IntegrationUsage[]> {
  const from = new Date();
  from.setUTCDate(1);
  from.setUTCHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("mkt_ai_usage")
    .select("service, cost_estimate")
    .gte("created_at", from.toISOString())
    .limit(2000);
  if (error) throw error;
  const map = new Map<string, IntegrationUsage>();
  for (const row of (data ?? []) as { service: string | null; cost_estimate: number | null }[]) {
    const key = row.service ?? "unknown";
    const current = map.get(key) ?? { service: key, count: 0, spent_usd: 0 };
    current.count += 1;
    current.spent_usd += Number(row.cost_estimate ?? 0);
    map.set(key, current);
  }
  return [...map.values()];
}

export function useIntegrationUsage() {
  return useQuery({
    queryKey: [...INTEGRATIONS_QUERY_KEY, "usage"],
    queryFn: fetchIntegrationUsage,
    staleTime: 60_000,
  });
}
