/**
 * Admin analytics reads.
 *
 * Every function here calls one `SECURITY DEFINER` RPC that re-checks
 * `mkt_is_platform_admin()` (or the staff work permission for `ops`) on the
 * server and raises `forbidden` otherwise. Hiding the page in the client is
 * cosmetic only: a non-admin calling these RPCs directly gets nothing.
 */
import { supabase } from "@/integrations/supabase/client";

export interface NamedMetric {
  metric: number;
  name?: string | null;
  name_ar?: string | null;
  name_en?: string | null;
  title?: string | null;
  term?: string | null;
  path?: string | null;
  samples?: number | null;
  id?: string | null;
  user_id?: string | null;
  tenant_id?: string | null;
  event_type?: string | null;
  message?: string | null;
}

export interface AnalyticsOverview {
  active_users_today: number;
  active_sessions_today: number;
  new_users_today: number;
  total_users: number;
  total_businesses: number;
  listings_published: number;
  listings_pending: number;
  listings_featured: number;
  listings_expired: number;
  conversations_today: number;
  messages_today: number;
  calls_today: number;
  reports_open: number;
  verifications_pending: number;
  quote_requests_open: number;
  quote_requests_closed: number;
  revenue_points_spent: number;
  revenue_money_enabled: boolean;
  generated_at: string;
}

export interface FunnelStep {
  key: string;
  value: number;
  source: string;
}

export interface AnalyticsFunnel {
  days: number;
  steps: FunnelStep[];
}

export interface AnalyticsListings {
  most_viewed: NamedMetric[];
  most_called: NamedMetric[];
  most_messaged: NamedMetric[];
  most_favorited: NamedMetric[];
  most_shared: NamedMetric[];
  zero_views: NamedMetric[];
  expired: NamedMetric[];
  reported: NamedMetric[];
  featured: NamedMetric[];
}

export interface AnalyticsField {
  category_id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
  listings: number;
  new_listings: number;
  expired: number;
  views: number;
  favorites: number;
  shares: number;
  reports: number;
  calls: number;
  conversations: number;
}

export interface AnalyticsSearch {
  searches: number;
  zero_result_searches: number;
  result_clicks: number;
  avg_duration_ms: number | null;
  top_terms: NamedMetric[];
  zero_terms: NamedMetric[];
  top_cities: NamedMetric[];
  top_categories: NamedMetric[];
}

export interface AnalyticsPeople {
  users: {
    total: number;
    new: number;
    active: number;
    inactive: number;
    banned: number;
    deleted: number;
    top_publishers: NamedMetric[];
    top_message_receivers: NamedMetric[];
    top_call_receivers: NamedMetric[];
  };
  businesses: {
    total: number;
    new: number;
    verified: number;
    top_active: NamedMetric[];
    top_viewed: NamedMetric[];
    top_conversations: NamedMetric[];
  };
}

export interface AnalyticsHealth {
  performance: {
    avg_page_ms: number | null;
    page_views: number;
    slowest_pages: NamedMetric[];
    realtime_tables: number;
  };
  errors: {
    js: number;
    api: number;
    image: number;
    storage: number;
    db: number;
    top: NamedMetric[];
  };
  security: {
    failed_logins: number;
    locked_accounts: number;
    banned_accounts: number;
    unauthorized_attempts: number;
    security_reviews: number;
    suspicious_scans: number;
  };
}

export interface AnalyticsOps {
  conversations: {
    new: number;
    messages: number;
    attachments: number;
    audio: number;
    locations: number;
    bank_shares: number;
    flagged: number;
  } | null;
  verification: {
    pending: number;
    in_review: number;
    approved: number;
    rejected: number;
    avg_review_hours: number | null;
  } | null;
  admin: {
    open_work: number;
    closed_work: number;
    staff_requests: number;
    operations_today: number;
    top_staff: NamedMetric[];
    lightest_staff: NamedMetric[];
  };
}

export interface AnalyticsGeoRow {
  id: string;
  name_ar: string;
  name_en: string | null;
  listings: number;
  users: number;
  businesses: number;
  events: number;
}

export interface AnalyticsDay {
  day: string;
  users: number;
  listings: number;
  conversations: number;
  messages: number;
  views: number;
  searches: number;
  revenue_points: number;
}

async function callRpc<T>(name: string, args: Record<string, number>): Promise<T> {
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw error;
  return data as T;
}

export const loadAnalyticsOverview = () =>
  callRpc<AnalyticsOverview>("mkt_analytics_overview", {});
export const loadAnalyticsFunnel = (days: number) =>
  callRpc<AnalyticsFunnel>("mkt_analytics_funnel", { _days: days });
export const loadAnalyticsListings = (limit = 10) =>
  callRpc<AnalyticsListings>("mkt_analytics_listings", { _limit: limit });
export const loadAnalyticsFields = (days: number) =>
  callRpc<AnalyticsField[]>("mkt_analytics_fields", { _days: days });
export const loadAnalyticsSearch = (days: number, limit = 15) =>
  callRpc<AnalyticsSearch>("mkt_analytics_search", { _days: days, _limit: limit });
export const loadAnalyticsPeople = (days: number, limit = 10) =>
  callRpc<AnalyticsPeople>("mkt_analytics_people", { _days: days, _limit: limit });
export const loadAnalyticsHealth = (days: number) =>
  callRpc<AnalyticsHealth>("mkt_analytics_health", { _days: days });
export const loadAnalyticsOps = (days: number) =>
  callRpc<AnalyticsOps>("mkt_analytics_ops", { _days: days });
export const loadAnalyticsGeo = (limit = 12) =>
  callRpc<AnalyticsGeoRow[]>("mkt_analytics_geo", { _limit: limit });
export const loadAnalyticsTimeseries = (days: number) =>
  callRpc<AnalyticsDay[]>("mkt_analytics_timeseries", { _days: days });
