/**
 * تقارير التحليلات — تُقرأ من مخطط `analytics` غير المكشوف عبر دالة قاعدة بيانات
 * تتحقق من صلاحية «analytics.view» بنفسها، فلا سطح قراءة مباشر للمخطط.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AnalyticsReport {
  from: string;
  totals: { events: number; sessions: number; visitors: number };
  daily: { day: string; events: number; sessions: number }[];
  top_routes: { route_path: string; events: number }[];
  top_events: { name: string; events: number }[];
  test_events: number;
}

export const getAnalyticsReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { days?: number; includeInternal?: boolean }) =>
    z
      .object({ days: z.number().int().min(1).max(180).default(30), includeInternal: z.boolean().default(false) })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<AnalyticsReport | { error: string }> => {
    const { data: report, error } = await context.supabase.rpc("mkt_analytics_report", {
      _days: data.days,
      _include_internal: data.includeInternal,
    } as never);
    if (error) {
      if (error.message.includes("FORBIDDEN")) return { error: "forbidden" };
      console.error("analytics report failed", error.message);
      return { error: "unavailable" };
    }
    return report as unknown as AnalyticsReport;
  });

export const purgeTestEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ deleted: number } | { error: string }> => {
    const { data, error } = await context.supabase.rpc("mkt_analytics_purge_test" as never, {} as never);
    if (error) return { error: error.message.includes("FORBIDDEN") ? "forbidden" : "unavailable" };
    return { deleted: Number(data ?? 0) };
  });
