/**
 * Client-side product analytics for the public marketplace.
 *
 * Everything recorded here goes through one server-side, rate-shaped RPC
 * (`mkt_track`) that decides what is storable: unknown event types are
 * dropped, strings are truncated, the batch is capped, and `user_id` is taken
 * from the verified session — never from the payload. Visitors (anon) are
 * counted through an opaque, rotating session id so the funnel has a real
 * top-of-funnel number without identifying anyone.
 *
 * No PII is ever sent: no e-mail, no phone, no free text typed into a form.
 * Only the search term (which the user typed to be matched publicly), the
 * route path, coarse device/browser buckets, and durations.
 */
import { supabase } from "@/integrations/supabase/client";

export type AnalyticsEventType =
  | "page_view"
  | "search"
  | "search_zero"
  | "search_click"
  | "listing_view"
  | "contact_click"
  | "error_js"
  | "error_api"
  | "error_image"
  | "error_storage"
  | "error_db"
  | "unauthorized";

export interface AnalyticsEvent {
  event_type: AnalyticsEventType;
  path?: string | undefined;
  listing_id?: string | undefined;
  category_id?: string | undefined;
  city_id?: string | undefined;
  query_text?: string | undefined;
  result_count?: number | undefined;
  duration_ms?: number | undefined;
  severity?: "info" | "warn" | "error" | undefined;
  message?: string | undefined;
}

const SESSION_KEY = "tahqaq.analytics.session";
/** A session is a visit: it ends after 30 idle minutes, like web analytics. */
const SESSION_TTL_MS = 30 * 60 * 1000;
const FLUSH_DELAY_MS = 1500;
const MAX_BATCH = 25;

function randomId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Opaque per-visit id kept in sessionStorage; never sent to third parties. */
function sessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const now = Date.now();
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { id: string; at: number };
      if (parsed.id && now - parsed.at < SESSION_TTL_MS) {
        window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: parsed.id, at: now }));
        return parsed.id;
      }
    }
    const id = randomId();
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, at: now }));
    return id;
  } catch {
    return null; // private mode / storage disabled → tracking simply stops
  }
}

function device(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

function browser(): "chrome" | "safari" | "firefox" | "edge" | "samsung" | "other" {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/Edg\//.test(ua)) return "edge";
  if (/SamsungBrowser/.test(ua)) return "samsung";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Chrome\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "other";
}

let queue: Record<string, unknown>[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush(): Promise<void> {
  timer = null;
  if (queue.length === 0) return;
  const batch = queue.slice(0, MAX_BATCH);
  queue = queue.slice(MAX_BATCH);
  try {
    await supabase.rpc("mkt_track", { _events: batch as unknown as never });
  } catch {
    /* analytics must never break the page or retry-storm */
  }
  if (queue.length > 0 && timer === null) timer = setTimeout(flush, FLUSH_DELAY_MS);
}

/** Queue one event. Safe to call anywhere; a no-op during SSR. */
export function track(event: AnalyticsEvent): void {
  if (typeof window === "undefined") return;
  const sid = sessionId();
  if (!sid) return;
  queue.push({
    ...event,
    session_id: sid,
    device: device(),
    browser: browser(),
    country_code: undefined,
    city_name: undefined,
  });
  if (queue.length >= MAX_BATCH) {
    void flush();
    return;
  }
  if (timer === null) timer = setTimeout(flush, FLUSH_DELAY_MS);
}

/** Send whatever is queued right away (used on tab hide / unload). */
export function flushAnalytics(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  void flush();
}
