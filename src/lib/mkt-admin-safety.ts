import { supabase } from "@/integrations/supabase/client";

/**
 * "Advertiser safety" — a compact administrative read on how trustworthy an
 * account is. Deliberately NOT a report counter: a submitted report is not a
 * violation, so confirmed reports, reports under review, invalid reports,
 * active restrictions and bans are all counted separately, and internal notes
 * are exposed as a flag only (never their text).
 */
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface AdvertiserSafety {
  verified: boolean;
  email_confirmed: boolean;
  phone_confirmed: boolean;
  reports_confirmed: number;
  reports_reviewing: number;
  reports_invalid: number;
  violations: number;
  active_restrictions: number;
  suspensions: number;
  banned: boolean;
  has_notes: boolean;
  last_violation_at: string | null;
  risk_score: number;
  risk_level: RiskLevel;
}

export async function loadAdvertiserSafety(
  userId: string,
  tenantId?: string | null,
): Promise<AdvertiserSafety> {
  const { data, error } = await supabase.rpc("mkt_advertiser_safety", {
    _user_id: userId,
    ...(tenantId ? { _tenant_id: tenantId } : {}),
  });
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  const level = row["risk_level"];
  return {
    verified: row["verified"] === true,
    email_confirmed: row["email_confirmed"] === true,
    phone_confirmed: row["phone_confirmed"] === true,
    reports_confirmed: Number(row["reports_confirmed"] ?? 0),
    reports_reviewing: Number(row["reports_reviewing"] ?? 0),
    reports_invalid: Number(row["reports_invalid"] ?? 0),
    violations: Number(row["violations"] ?? 0),
    active_restrictions: Number(row["active_restrictions"] ?? 0),
    suspensions: Number(row["suspensions"] ?? 0),
    banned: row["banned"] === true,
    has_notes: row["has_notes"] === true,
    last_violation_at: typeof row["last_violation_at"] === "string" ? row["last_violation_at"] : null,
    risk_score: Number(row["risk_score"] ?? 0),
    risk_level:
      level === "critical" || level === "high" || level === "medium" ? level : "low",
  };
}

export const RISK_TONE: Record<RiskLevel, "critical" | "urgent" | "pending" | "done"> = {
  critical: "critical",
  high: "urgent",
  medium: "pending",
  low: "done",
};
