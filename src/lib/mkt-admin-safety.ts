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

/** Ordering weight for "highest risk first" sorts. */
export const RISK_ORDER: Record<RiskLevel, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export type SafetyKey = string;

/** Stable cache/lookup key for one advertiser (user, optionally inside a tenant). */
export function safetyKey(userId: string, tenantId?: string | null): SafetyKey {
  return `${userId}::${tenantId ?? ""}`;
}

/**
 * Batch read of advertiser safety for a list of subjects, used by admin lists
 * that need the summary on every card (and want to sort by risk). Requests run
 * in small concurrent batches so a long page never floods the API, and a single
 * failing subject is skipped rather than failing the whole list.
 */
export async function loadAdvertiserSafetyMap(
  subjects: { userId: string; tenantId?: string | null }[],
  batchSize = 8,
): Promise<Record<SafetyKey, AdvertiserSafety>> {
  const unique = new Map<SafetyKey, { userId: string; tenantId?: string | null }>();
  for (const subject of subjects) {
    if (!subject.userId) continue;
    unique.set(safetyKey(subject.userId, subject.tenantId), subject);
  }
  const entries = Array.from(unique.entries());
  const out: Record<SafetyKey, AdvertiserSafety> = {};
  for (let i = 0; i < entries.length; i += batchSize) {
    const slice = entries.slice(i, i + batchSize);
    const results = await Promise.all(
      slice.map(async ([key, subject]) => {
        try {
          return [key, await loadAdvertiserSafety(subject.userId, subject.tenantId ?? null)] as const;
        } catch {
          return null;
        }
      }),
    );
    for (const row of results) if (row) out[row[0]] = row[1];
  }
  return out;
}
