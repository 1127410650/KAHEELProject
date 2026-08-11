/**
 * إحصاءات المالك — تُقرأ عبر دالة واحدة (`mkt_owner_analytics`) تحلّ الملكية
 * على الخادم من الجلسة والهوية النشطة.
 *
 * لا يُمرَّر أي معرّف مالك من المتصفح: الحساب الفردي يُقاس بـ `auth.uid()`،
 * وحساب المنشأة يُقاس بـ `tenant_id` بشرط عضوية نشطة داخل الدالة نفسها. لذلك
 * تمرير معرّف كيان آخر لا يعيد شيئًا. حركة الفريق والحسابات التجريبية مستثناة
 * في الدالة، والشرائح الأصغر من 5 جلسات تُدمج في «أخرى».
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface OwnerAnalyticsTotals {
  impressions: number;
  detail_visits: number;
  contact_clicks: number;
  favorites: number;
  shares: number;
  sessions: number;
}

export interface OwnerAnalyticsDaily {
  day: string;
  detail_visits: number;
  contact_clicks: number;
  sessions: number;
}

export interface OwnerAnalyticsSlice {
  label: string;
  sessions: number;
}

export interface OwnerAnalyticsTopListing {
  listing_id: string;
  detail_visits: number;
  contact_clicks: number;
}

export interface OwnerAnalytics {
  from: string | null;
  listings: number;
  totals: OwnerAnalyticsTotals;
  daily: OwnerAnalyticsDaily[];
  countries: OwnerAnalyticsSlice[];
  top_listings: OwnerAnalyticsTopListing[];
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalize(raw: Record<string, unknown> | null): OwnerAnalytics {
  const totals = (raw?.["totals"] ?? {}) as Record<string, unknown>;
  return {
    from: raw?.["from"] ? String(raw["from"]) : null,
    listings: num(raw?.["listings"]),
    totals: {
      impressions: num(totals["impressions"]),
      detail_visits: num(totals["detail_visits"]),
      contact_clicks: num(totals["contact_clicks"]),
      favorites: num(totals["favorites"]),
      shares: num(totals["shares"]),
      sessions: num(totals["sessions"]),
    },
    daily: ((raw?.["daily"] ?? []) as Array<Record<string, unknown>>).map((row) => ({
      day: String(row["day"] ?? ""),
      detail_visits: num(row["detail_visits"]),
      contact_clicks: num(row["contact_clicks"]),
      sessions: num(row["sessions"]),
    })),
    countries: ((raw?.["countries"] ?? []) as Array<Record<string, unknown>>).map((row) => ({
      label: String(row["label"] ?? "أخرى"),
      sessions: num(row["sessions"]),
    })),
    top_listings: ((raw?.["top_listings"] ?? []) as Array<Record<string, unknown>>).map((row) => ({
      listing_id: String(row["listing_id"] ?? ""),
      detail_visits: num(row["detail_visits"]),
      contact_clicks: num(row["contact_clicks"]),
    })),
  };
}

export const OWNER_ANALYTICS_RANGES = [7, 30, 90] as const;
export type OwnerAnalyticsRange = (typeof OWNER_ANALYTICS_RANGES)[number];

export function useOwnerAnalytics(input: {
  days: OwnerAnalyticsRange;
  tenantId: string | null;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["mkt", "owner-analytics", input.tenantId ?? "individual", input.days],
    enabled: input.enabled !== false,
    staleTime: 60_000,
    queryFn: async (): Promise<OwnerAnalytics> => {
      const { data, error } = await supabase.rpc("mkt_owner_analytics" as never, {
        _days: input.days,
        _tenant_id: input.tenantId,
      } as never);
      if (error) throw error;
      return normalize((data ?? null) as unknown as Record<string, unknown> | null);
    },
  });
}
