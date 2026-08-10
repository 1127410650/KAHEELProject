/**
 * بروفايل المعلن العقاري العام — قراءة محدودة الحقول.
 *
 * البيانات تأتي من دالة `mkt_re_provider_public` التي تقرر ما يُنشر:
 * الجوال والبريد لا يُرجَعان إلا إذا فعّل المعلن إظهارهما بنفسه، والجدول
 * نفسه لم يعد يسمح بقراءة هذه الأعمدة عبر الـ API.
 */

import { supabase } from "@/integrations/supabase/client";

export type AqarProviderType = "agency" | "hotel" | "individual";

export interface AqarPublicProvider {
  id: string;
  slug: string;
  display_name: string;
  provider_type: AqarProviderType;
  city: string | null;
  verification_status: string;
  is_demo: boolean;
  bio: string | null;
  created_at: string;
  /** يُرجع فقط إذا فعّل المعلن إظهار الجوال. */
  phone: string | null;
  whatsapp: string | null;
  public_email: string | null;
  active_listings: number;
  /** متوسط دقائق الرد على الطلبات المحسومة فعلًا، أو null إذا لا بيانات. */
  avg_response_minutes: number | null;
  rating: number | null;
}

export const AQAR_PROVIDER_TYPE_LABELS: Record<AqarProviderType, string> = {
  agency: "مكتب عقاري",
  hotel: "فندق",
  individual: "فرد",
};

export async function fetchAqarPublicProvider(slug: string): Promise<AqarPublicProvider | null> {
  const { data, error } = await supabase.rpc("mkt_re_provider_public", { _slug: slug });
  if (error) return null;
  const rows = (data ?? []) as AqarPublicProvider[];
  return rows[0] ?? null;
}

/** صياغة صادقة لسرعة الرد: لا نخترع رقمًا حين لا توجد طلبات محسومة. */
export function formatResponseSpeed(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return "لا توجد بيانات كافية";
  if (minutes < 60) return `${Math.max(1, Math.round(minutes)).toLocaleString("en-US")} دقيقة`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours).toLocaleString("en-US")} ساعة`;
  return `${Math.round(hours / 24).toLocaleString("en-US")} يوم`;
}
