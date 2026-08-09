/**
 * Pacing + politeness rules for the light promo cards (`PromoPopupHost`).
 *
 * The platform owner wants the cards to come back "every little while" during
 * browsing, so the cadence is deliberately *soft*: a first card long after the
 * visit starts, then one every few minutes of ACTIVE browsing, capped per
 * session, never twice with the same line/mascot/side in a row.
 *
 * Every number lives in `mkt_platform_settings` under the `popup_pacing`
 * section (key `popup.pacing`), readable by anyone and writable only by a
 * platform admin, so the owner can retune the rhythm from the admin console
 * without a code change.
 *
 * The "do not annoy" rules are hard gates, not hints:
 *  - never while a field is focused (the visitor is typing),
 *  - never on chat / checkout / payment / upload / listing-form style routes,
 *  - never during a live call,
 *  - never in the first `page_settle_ms` after a page render,
 *  - two fast closes (< 2s each) stop the cards for the rest of the session,
 *  - "not today" mutes them for 24 hours.
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface PopupPacing {
  /** Delay before the first card of a session. */
  firstDelayMs: number;
  /** Gap between cards, measured in active browsing time. */
  intervalMs: number;
  /** Hard ceiling per session. */
  maxPerSession: number;
  /** How long a card lingers when the visitor ignores it. */
  autoDismissMs: number;
  /** Quiet window right after a page render. */
  pageSettleMs: number;
  enabled: boolean;
  // ── مشاهد الشخصيتين (سقوط عند اللمس / مزحة الكبس / دخول قسم الناس) ───────
  /** فاصل بين سقوطين عند اللمس. */
  dropCooldownMs: number;
  /** بقاء بطاقة السقوط على الشاشة. */
  dropVisibleMs: number;
  /** عدد الضغطات السريعة التي تستدعي مزحة الكبس. */
  rapidTaps: number;
  /** نافذة رصد الكبس السريع. */
  rapidWindowMs: number;
  /** مدة مشهد دخول كَحيلان إلى قسم «الناس». */
  entranceMs: number;
  // ── تجوّل الشخصيتين عبر الصفحات ───────────────────────────────────────────
  /** تشغيل/إيقاف التجوّل كليًا من لوحة الإدارة. */
  roamEnabled: boolean;
  /** مهلة قبل أول تجوّل في الزيارة. */
  roamFirstDelayMs: number;
  /** الفاصل بين تجوّلين. */
  roamIntervalMs: number;
  /** مدة مشهد التجوّل الواحد (المشي من حافة إلى حافة). */
  roamDurationMs: number;
  // ── حدود «شخصية واحدة فقط وبتكرار قليل» (مسرح الشخصيات) ───────────────────
  /** أدنى فاصل بين أي ظهورين لأي شخصية، بزمن التصفح النشط. */
  mascotMinGapMs: number;
  /** حد أقصى لظهورات الشخصيات في الجلسة الواحدة. */
  mascotMaxPerSession: number;
  /** فترة صمت إجبارية بعد إغلاق أي بطاقة. */
  mascotQuietAfterCloseMs: number;
  /** مدة سكون التمرير المطلوبة قبل الظهور (الزائر ثبت على منطقة يقرأها). */
  mascotIdleMs: number;
}

export const DEFAULT_PACING: PopupPacing = {
  firstDelayMs: 45_000,
  intervalMs: 210_000,
  maxPerSession: 5,
  autoDismissMs: 7_000,
  pageSettleMs: 3_000,
  enabled: true,
  dropCooldownMs: 18_000,
  dropVisibleMs: 1_800,
  rapidTaps: 6,
  rapidWindowMs: 3_000,
  entranceMs: 6_000,
  roamEnabled: true,
  roamFirstDelayMs: 90_000,
  roamIntervalMs: 300_000,
  roamDurationMs: 14_000,
  mascotMinGapMs: 50_000,
  mascotMaxPerSession: 6,
  mascotQuietAfterCloseMs: 45_000,
  mascotIdleMs: 2_500,
};

/** Clamps admin input so a typo can never turn the cards into a nuisance. */
export function normalisePacing(raw: Record<string, unknown> | null | undefined): PopupPacing {
  const num = (key: string, fallback: number, min: number, max: number) => {
    const value = Number(raw?.[key]);
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, Math.round(value)));
  };
  return {
    firstDelayMs: num("first_delay_ms", DEFAULT_PACING.firstDelayMs, 5_000, 600_000),
    intervalMs: num("interval_ms", DEFAULT_PACING.intervalMs, 30_000, 3_600_000),
    maxPerSession: num("max_per_session", DEFAULT_PACING.maxPerSession, 0, 12),
    autoDismissMs: num("auto_dismiss_ms", DEFAULT_PACING.autoDismissMs, 3_000, 20_000),
    pageSettleMs: num("page_settle_ms", DEFAULT_PACING.pageSettleMs, 0, 30_000),
    dropCooldownMs: num("drop_cooldown_ms", DEFAULT_PACING.dropCooldownMs, 2_000, 300_000),
    dropVisibleMs: num("drop_visible_ms", DEFAULT_PACING.dropVisibleMs, 1_100, 15_000),
    rapidTaps: num("rapid_taps", DEFAULT_PACING.rapidTaps, 3, 15),
    rapidWindowMs: num("rapid_window_ms", DEFAULT_PACING.rapidWindowMs, 1_000, 15_000),
    entranceMs: num("entrance_ms", DEFAULT_PACING.entranceMs, 2_000, 20_000),
    roamFirstDelayMs: num("roam_first_delay_ms", DEFAULT_PACING.roamFirstDelayMs, 10_000, 600_000),
    roamIntervalMs: num("roam_interval_ms", DEFAULT_PACING.roamIntervalMs, 60_000, 3_600_000),
    roamDurationMs: num("roam_duration_ms", DEFAULT_PACING.roamDurationMs, 6_000, 40_000),
    // الظهور مرتبط بسكون التمرير، والحدود تمنع الإزعاج: لا أقل من ٢٠ ثانية بين
    // ظهورين، ولا أكثر من ٨ في الجلسة، ولا سكون أقصر من ثانية — حتى لو أُدخل
    // رقم صغير بالخطأ من لوحة الإدارة.
    mascotMinGapMs: num("mascot_min_gap_ms", DEFAULT_PACING.mascotMinGapMs, 20_000, 3_600_000),
    mascotMaxPerSession: num("mascot_max_per_session", DEFAULT_PACING.mascotMaxPerSession, 0, 8),
    mascotQuietAfterCloseMs: num(
      "mascot_quiet_after_close_ms",
      DEFAULT_PACING.mascotQuietAfterCloseMs,
      15_000,
      1_800_000,
    ),
    mascotIdleMs: num("mascot_idle_ms", DEFAULT_PACING.mascotIdleMs, 1_000, 10_000),
    roamEnabled: raw?.["roam_enabled"] !== false,
    enabled: raw?.["enabled"] !== false,
  };
}

export const POPUP_PACING_KEY = "popup.pacing";

export async function loadPopupPacing(): Promise<PopupPacing> {
  const { data } = await supabase
    .from("mkt_platform_settings")
    .select("value")
    .eq("key", POPUP_PACING_KEY)
    .maybeSingle();
  return normalisePacing((data as { value?: Record<string, unknown> } | null)?.value);
}

/** Cached for the whole visit: the rhythm does not need to be live. */
export function usePopupPacing() {
  const query = useQuery({
    queryKey: ["mkt", "popup-pacing"],
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: loadPopupPacing,
  });
  // لا تجاوزات تطوير هنا: الأرقام المعتمدة من لوحة الإدارة هي الحاكم الوحيد.
  return { ...DEFAULT_PACING, ...(query.data ?? {}) };
}


// ── "Not today" mute ────────────────────────────────────────────────────────
const MUTE_KEY = "kaheel.popup.mutedUntil";

export function popupsMuted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(MUTE_KEY);
    return !!raw && Number(raw) > Date.now();
  } catch {
    return false;
  }
}

export function mutePopups(hours = 24): void {
  try {
    window.localStorage.setItem(MUTE_KEY, String(Date.now() + hours * 60 * 60 * 1000));
  } catch {
    /* private mode: the mute simply lasts for this session only */
  }
}

// ── Session memory ──────────────────────────────────────────────────────────
export interface PopupSessionState {
  /** Cards already shown in this session. */
  shown: number;
  /** Last copy index / mascot / side, so nothing repeats back to back. */
  lastCopy: number;
  lastMascot: string;
  lastSide: string;
  /** Consecutive "closed in under two seconds" events. */
  quickCloses: number;
  /** Set once the visitor signalled irritation; no more cards this session. */
  stopped: boolean;
}

const SESSION_KEY = "kaheel.popup.session";

const EMPTY_STATE: PopupSessionState = {
  shown: 0,
  lastCopy: -1,
  lastMascot: "",
  lastSide: "",
  quickCloses: 0,
  stopped: false,
};

export function loadPopupSession(): PopupSessionState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return EMPTY_STATE;
    return { ...EMPTY_STATE, ...(JSON.parse(raw) as Partial<PopupSessionState>) };
  } catch {
    return EMPTY_STATE;
  }
}

export function savePopupSession(state: PopupSessionState): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch {
    /* nothing to do: the cap then applies per page instead of per session */
  }
}

// ── Quiet contexts ──────────────────────────────────────────────────────────
/**
 * Routes where a promo card would interrupt real work: conversations, money,
 * uploads, forms and every admin/business console screen.
 */
const QUIET_PREFIXES = [
  "/admin",
  "/business",
  "/dashboard",
  "/auth",
  "/register",
  "/join",
  "/invite",
  "/forgot-password",
  "/reset-password",
  "/choose-account",
  "/market-setup",
  "/my/messages",
  "/my/ads/new",
  "/my/wallet",
  "/my/ad-credit",
  "/my/quotes",
  "/my/reports",
];

/**
 * قسم «الناس»: دليل الجهات والأشخاص والملفات العامة — المكان الذي يدخله
 * «الزعيم كَحيلان» بمشهد التعريف. يُضاف إليه أي مسار ناس جديد من هنا فقط.
 */
const PEOPLE_PREFIXES = ["/guides", "/profiles"];

export function isPeoplePath(pathname: string): boolean {
  const path = pathname.toLowerCase();
  return PEOPLE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function isQuietPath(pathname: string): boolean {
  const path = pathname.toLowerCase();
  if (QUIET_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return true;
  // Listing edit, service booking, checkout and cart flows.
  if (/\/(edit|book|checkout|cart|pay|payment|new)(\/|$)/.test(path)) return true;
  return false;
}

/** True while the visitor is typing in any field, including rich editors. */
export function isTypingNow(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Explicit suppression for flows that are not identifiable from the URL —
 * an in-flight upload, a payment sheet, a half-filled dialog. Call it when the
 * flow starts and run the returned release when it ends.
 */
let suppressions = 0;

export function suppressPopups(): () => void {
  suppressions += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    suppressions = Math.max(0, suppressions - 1);
  };
}

export function popupsSuppressed(): boolean {
  return suppressions > 0;
}
