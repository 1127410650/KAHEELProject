/**
 * قراءة تحويلات مسارات الأقسام على الخادم (بمفتاح النشر العام).
 *
 * الجدول `mkt_category_redirects` مقروء للعامة، فالتحويل يُحسم قبل إرسال أي
 * HTML ويعود للزائر برمز 301 حقيقي لا تحويل داخل المتصفح.
 */
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

export async function resolveRedirectPath(fromPath: string): Promise<string | null> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;

  const client = createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data } = await client
    .from("mkt_category_redirects")
    .select("to_path")
    .eq("from_path", fromPath)
    .maybeSingle();

  const to = data?.to_path ?? null;
  if (!to || to === fromPath) return null;
  return to;
}
