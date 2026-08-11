/**
 * Automatic instrumentation: route changes, client errors, and unload flush.
 *
 * Mounted once in the root route so every marketplace page is counted without
 * per-page code. Page timing comes from the browser's own Navigation/Paint
 * timings on the first load and from a monotonic clock for client navigations,
 * so "average page speed" in the admin dashboard is a measured number.
 */
import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";

import { flushAnalytics, track } from "@/lib/analytics";
import { flushTracking, trackPageView } from "@/lib/track";


export function useAnalyticsInstrumentation(): void {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const mountedAt = useRef<number>(0);
  const first = useRef(true);

  // Page views + duration.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let duration = 0;
    if (first.current) {
      first.current = false;
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      duration = nav ? Math.round(nav.domContentLoadedEventEnd) : Math.round(performance.now());
    } else {
      duration = Math.max(0, Math.round(performance.now() - mountedAt.current));
    }
    mountedAt.current = performance.now();
    track({ event_type: "page_view", path: pathname, duration_ms: duration });
    // نفس الحدث في محرك التتبع الموحّد (`analytics.events_raw`) الذي تقرأ منه
    // شاشات التحليلات — سجل `mkt_analytics_events` يبقى لإشارات الأخطاء والسرعة
    // فقط، فلا مقياس منتج محسوب مرتين.
    trackPageView(pathname.startsWith("/admin") ? "admin" : "market");
  }, [pathname]);


  // Client-side error signals.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onError = (e: ErrorEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === "IMG") {
        track({ event_type: "error_image", path: window.location.pathname, severity: "warn" });
        return;
      }
      track({
        event_type: "error_js",
        path: window.location.pathname,
        severity: "error",
        message: e.message,
      });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason as { message?: string; code?: string; status?: number } | undefined;
      const message = reason?.message ?? String(e.reason ?? "unhandled rejection");
      // Supabase/PostgREST failures carry a `code`; fetch failures do not.
      const type = reason?.code ? "error_db" : /fetch|network|api|http/i.test(message) ? "error_api" : "error_js";
      const isDenied = reason?.code === "42501" || reason?.status === 401 || reason?.status === 403;
      track({
        event_type: isDenied ? "unauthorized" : type,
        path: window.location.pathname,
        severity: "error",
        message,
      });
    };
    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  // Do not lose the tail of a visit.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onHide = () => flushAnalytics();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);
}
