/**
 * بيانات لوحة المدير العام (/admin) — استعلامات حقيقية فقط.
 *
 * كل رقم هنا يُقرأ من الجداول مباشرة عبر عميل المتصفح (سياسات RLS تسمح
 * لمسؤول المنصة فقط)، والصفوف التجريبية `is_demo` مستثناة افتراضيًا مع مفتاح
 * «مع التجريبي» في الواجهة. لا رقم تقديري ولا قيمة ثابتة.
 */
import { supabase } from "@/integrations/supabase/client";

export type KpiRange = 1 | 7 | 30;

export interface KpiSeries {
  /** عدد لكل يوم من أقدم إلى أحدث — لرسم الخط الصغير. */
  points: number[];
  total: number;
}

export interface GmKpis {
  newUsers: KpiSeries;
  newListings: KpiSeries;
  listingsByCategory: { label: string; count: number }[];
  errands: KpiSeries;
  serviceBookings: KpiSeries;
  aqarBookings: KpiSeries;
  conversations: KpiSeries;
  campaignImpressions: number;
  campaignClicks: number;
  campaignCtr: number;
  topupsPending: number;
  topupsPendingAmount: number;
  reviews: KpiSeries;
}

function rangeStart(range: KpiRange): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (range - 1));
  return start.toISOString();
}

function buildSeries(dates: (string | null)[], range: KpiRange): KpiSeries {
  const buckets = new Array(range).fill(0) as number[];
  const start = new Date(rangeStart(range)).getTime();
  const day = 86_400_000;
  let total = 0;
  for (const value of dates) {
    if (!value) continue;
    total += 1;
    const index = Math.floor((new Date(value).getTime() - start) / day);
    if (index >= 0 && index < range) buckets[index] = (buckets[index] ?? 0) + 1;
  }
  return { points: buckets, total };
}

async function fetchDates(
  table:
    | "mkt_user_profiles"
    | "mkt_errand_requests"
    | "mkt_service_bookings"
    | "mkt_realestate_bookings"
    | "mkt_conversations"
    | "mkt_service_reviews"
    | "mkt_realestate_reviews",
  since: string,
): Promise<(string | null)[]> {
  const { data } = await supabase
    .from(table)
    .select("created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(5000);
  return ((data ?? []) as { created_at: string | null }[]).map((row) => row.created_at);
}

export async function loadGmKpis(range: KpiRange, includeDemo: boolean): Promise<GmKpis> {
  const since = rangeStart(range);

  const listingsQuery = supabase
    .from("mkt_listings")
    .select("created_at, category_id, mkt_categories!mkt_listings_category_id_fkey(name_ar)")
    .gte("created_at", since)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(5000);
  if (!includeDemo) listingsQuery.eq("is_demo", false);

  const [
    users,
    listings,
    errands,
    serviceBookings,
    aqarBookings,
    conversations,
    serviceReviews,
    aqarReviews,
    campaigns,
    topups,
  ] = await Promise.all([
    fetchDates("mkt_user_profiles", since),
    listingsQuery,
    fetchDates("mkt_errand_requests", since),
    fetchDates("mkt_service_bookings", since),
    fetchDates("mkt_realestate_bookings", since),
    fetchDates("mkt_conversations", since),
    fetchDates("mkt_service_reviews", since),
    fetchDates("mkt_realestate_reviews", since),
    supabase.from("mkt_ad_campaigns").select("impressions, clicks").limit(2000),
    supabase.from("mkt_ad_credit_topups").select("amount").eq("status", "pending").limit(2000),
  ]);

  const listingRows = (listings.data ?? []) as {
    created_at: string | null;
    mkt_categories?: { name_ar?: string | null } | null;
  }[];

  const byCategory = new Map<string, number>();
  for (const row of listingRows) {
    const label = row.mkt_categories?.name_ar ?? "غير مصنّف";
    byCategory.set(label, (byCategory.get(label) ?? 0) + 1);
  }

  const campaignRows = (campaigns.data ?? []) as { impressions: number | null; clicks: number | null }[];
  const impressions = campaignRows.reduce((sum, row) => sum + (row.impressions ?? 0), 0);
  const clicks = campaignRows.reduce((sum, row) => sum + (row.clicks ?? 0), 0);

  const topupRows = (topups.data ?? []) as { amount: number | null }[];

  const reviewDates = [...serviceReviews, ...aqarReviews];

  return {
    newUsers: buildSeries(users, range),
    newListings: buildSeries(
      listingRows.map((row) => row.created_at),
      range,
    ),
    listingsByCategory: [...byCategory.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    errands: buildSeries(errands, range),
    serviceBookings: buildSeries(serviceBookings, range),
    aqarBookings: buildSeries(aqarBookings, range),
    conversations: buildSeries(conversations, range),
    campaignImpressions: impressions,
    campaignClicks: clicks,
    campaignCtr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    topupsPending: topupRows.length,
    topupsPendingAmount: topupRows.reduce((sum, row) => sum + (row.amount ?? 0), 0),
    reviews: buildSeries(reviewDates, range),
  };
}

/* ------------------------------- طوابير العمل ------------------------------ */

export interface GmQueue {
  key: string;
  count: number;
  to: string;
  urgency: number;
}

async function countRows(
  build: () => PromiseLike<{ count: number | null }>,
): Promise<number> {
  const { count } = await build();
  return count ?? 0;
}

export async function loadGmQueues(): Promise<GmQueue[]> {
  const soon = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
  const now = new Date().toISOString();

  const [verifications, saleListings, topups, reports, claims, removals, expiring] =
    await Promise.all([
      countRows(() =>
        supabase
          .from("mkt_verification_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ),
      countRows(() =>
        supabase
          .from("mkt_listings")
          .select("id", { count: "exact", head: true })
          .eq("status", "under_review")
          .is("deleted_at", null),
      ),
      countRows(() =>
        supabase
          .from("mkt_ad_credit_topups")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ),
      countRows(() =>
        supabase
          .from("mkt_reports")
          .select("id", { count: "exact", head: true })
          .in("status", ["new", "under_review"]),
      ),
      countRows(() =>
        supabase
          .from("mkt_guide_place_claims")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ),
      countRows(() =>
        supabase
          .from("mkt_guide_removal_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ),
      countRows(() =>
        supabase
          .from("mkt_ad_campaigns")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .not("ends_at", "is", null)
          .gte("ends_at", now)
          .lte("ends_at", soon),
      ),
    ]);

  return [
    { key: "verifications", count: verifications, to: "/admin/verification", urgency: 1 },
    { key: "saleListings", count: saleListings, to: "/admin/listings", urgency: 2 },
    { key: "topups", count: topups, to: "/admin/wallets", urgency: 3 },
    { key: "reports", count: reports, to: "/admin/reports", urgency: 4 },
    { key: "claims", count: claims, to: "/admin/guide-claims", urgency: 5 },
    { key: "removals", count: removals, to: "/admin/guide-claims", urgency: 6 },
    { key: "expiring", count: expiring, to: "/admin/campaigns", urgency: 7 },
  ].sort((a, b) => (b.count > 0 ? 1 : 0) - (a.count > 0 ? 1 : 0) || a.urgency - b.urgency);
}

/* -------------------------------- سجل النشاط ------------------------------- */

export interface GmEvent {
  id: string;
  kind: "listing" | "report" | "appearance" | "palette" | "blocks";
  title: string;
  at: string;
}

export async function loadGmFeed(): Promise<GmEvent[]> {
  const [listings, reports, slots, palette, blocks] = await Promise.all([
    supabase
      .from("mkt_listings")
      .select("id, title, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("mkt_reports")
      .select("id, ref_no, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("mkt_media_slot_history")
      .select("id, slot_key, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("mkt_theme_audit")
      .select("id, palette_name, action, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("mkt_page_block_audit")
      .select("id, page, action, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const events: GmEvent[] = [];
  for (const row of (listings.data ?? []) as { id: string; title: string | null; created_at: string }[]) {
    events.push({ id: `l-${row.id}`, kind: "listing", title: row.title ?? "إعلان", at: row.created_at });
  }
  for (const row of (reports.data ?? []) as { id: string; ref_no: string | null; created_at: string }[]) {
    events.push({ id: `r-${row.id}`, kind: "report", title: row.ref_no ?? "بلاغ", at: row.created_at });
  }
  for (const row of (slots.data ?? []) as { id: string; slot_key: string; created_at: string }[]) {
    events.push({ id: `s-${row.id}`, kind: "appearance", title: row.slot_key, at: row.created_at });
  }
  for (const row of (palette.data ?? []) as {
    id: string;
    palette_name: string | null;
    action: string | null;
    created_at: string;
  }[]) {
    events.push({
      id: `p-${row.id}`,
      kind: "palette",
      title: `${row.palette_name ?? "لوحة"} — ${row.action ?? ""}`.trim(),
      at: row.created_at,
    });
  }
  for (const row of (blocks.data ?? []) as {
    id: string;
    page: string | null;
    action: string | null;
    created_at: string;
  }[]) {
    events.push({
      id: `b-${row.id}`,
      kind: "blocks",
      title: `${row.page ?? "صفحة"} — ${row.action ?? ""}`.trim(),
      at: row.created_at,
    });
  }

  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
}

/* --------------------------------- الصحّة --------------------------------- */

export interface GmHealth {
  emptySlots: number;
  demoListings: number;
  demoStories: number;
  demoAccounts: number;
  lastAppearanceEdit: string | null;
  activePalette: string | null;
}

export async function loadGmHealth(): Promise<GmHealth> {
  const [empty, demoListings, demoStories, demoAccounts, lastEdit, palette] = await Promise.all([
    supabase
      .from("mkt_media_slots")
      .select("slot_key", { count: "exact", head: true })
      .is("path", null)
      .is("external_url", null),
    supabase
      .from("mkt_listings")
      .select("id", { count: "exact", head: true })
      .eq("is_demo", true)
      .is("deleted_at", null),
    supabase.from("mkt_stories").select("id", { count: "exact", head: true }).eq("is_demo", true),
    supabase
      .from("mkt_demo_accounts")
      .select("id", { count: "exact", head: true })
      .eq("is_demo", true),
    supabase
      .from("mkt_media_slot_history")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("mkt_theme_audit")
      .select("palette_name")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    emptySlots: empty.count ?? 0,
    demoListings: demoListings.count ?? 0,
    demoStories: demoStories.count ?? 0,
    demoAccounts: demoAccounts.count ?? 0,
    lastAppearanceEdit: (lastEdit.data?.created_at as string | null) ?? null,
    activePalette: (palette.data?.palette_name as string | null) ?? null,
  };
}

/** إخفاء ناعم للبيانات التجريبية: لا حذف نهائي لأي سجل. */
export async function softPurgeDemoData(): Promise<{ listings: number; stories: number }> {
  const listings = await supabase
    .from("mkt_listings")
    .update({ deleted_at: new Date().toISOString(), status: "archived" })
    .eq("is_demo", true)
    .is("deleted_at", null)
    .select("id");
  const stories = await supabase
    .from("mkt_stories")
    .update({ status: "archived" })
    .eq("is_demo", true)
    .neq("status", "archived")
    .select("id");

  return {
    listings: (listings.data ?? []).length,
    stories: (stories.data ?? []).length,
  };
}

/* ------------------------- عدّادات صرف الذكاء الاصطناعي ------------------------ */

export interface AiCapabilitySpend {
  capability: "generation" | "enhancement";
  monthly_usd: number;
  spent_usd: number;
  remaining_usd: number;
  count: number;
  blocked: boolean;
}

export async function loadAiSpend(): Promise<AiCapabilitySpend[]> {
  const { data, error } = await supabase.rpc("mkt_ai_spend_summary");
  if (error) throw error;
  const payload = (data ?? {}) as { capabilities?: AiCapabilitySpend[] };
  return payload.capabilities ?? [];
}

export async function setAiCapabilityBudget(
  capability: "generation" | "enhancement",
  usd: number,
): Promise<void> {
  const { error } = await supabase.rpc("mkt_ai_set_capability_budget", {
    _capability: capability,
    _usd: usd,
  });
  if (error) throw error;
}
