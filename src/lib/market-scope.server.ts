/**
 * حلّ رمز الدولة على الخادم من رقم الجوال نفسه.
 *
 * لا يُكتب رمز دولة ثابت في تسجيل الدخول أو إنشاء الحساب: نطابق مفتاح الاتصال
 * مع الدول المفعّلة في `mkt_countries`، وإن لم يُطابق شيء نستخدم الدولة
 * الافتراضية المفعّلة. عند تفعيل لبنان يصير +961 مقبولًا بلا أي تعديل هنا.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FALLBACK_ISO2 = "SY";

export async function resolveMarketIso2ByPhone(phoneE164: string | null): Promise<string> {
  const digits = (phoneE164 ?? "").replace(/\D/g, "");
  const { data } = await supabaseAdmin
    .from("mkt_countries")
    .select("iso2, calling_code, is_default_market")
    .eq("is_active", true)
    .eq("is_market_enabled", true)
    .order("sort_order");

  const rows = data ?? [];
  if (rows.length === 0) return FALLBACK_ISO2;

  const matched = rows
    .map((row) => ({ iso2: row.iso2, dial: (row.calling_code ?? "").replace(/\D/g, "") }))
    .filter((row) => row.dial && digits.startsWith(row.dial))
    .sort((a, b) => b.dial.length - a.dial.length)[0];
  if (matched) return matched.iso2;

  return rows.find((row) => row.is_default_market)?.iso2 ?? rows[0]?.iso2 ?? FALLBACK_ISO2;
}
