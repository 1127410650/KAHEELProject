/**
 * طبقة «أين هذا؟» — تمييز مكان عنصر قابل للتعديل داخل الصفحة الحقيقية.
 *
 * تعمل فقط عند وجود المعامل `?kfocus=` في الرابط، فالزائر العادي لا يتأثر:
 *
 *   /?kfocus=block:<uuid>     ⇒ كتلة من مؤلّف الصفحات (`data-kblock`)
 *   /aqar?kfocus=slot:aqar.hero ⇒ فتحة وسائط (`data-kslot`)
 *
 * ما تفعله: تنتظر ظهور العنصر (المحتوى المؤجّل قد يتأخر)، تُمرّر الشاشة إليه،
 * ثم ترسم إطارًا نابضًا حوله. لا كتابة ولا صلاحيات — تمييز بصري فقط، لذلك
 * يمكن فتحه داخل إطار (iframe) من شاشة الإدارة بأمان.
 */
import { useEffect, useState } from "react";

const PULSE_CSS = `
@keyframes k-focus-pulse{
  0%{box-shadow:0 0 0 3px var(--kt-primary,#0e9f6e),0 0 0 6px rgba(14,159,110,.28)}
  50%{box-shadow:0 0 0 3px var(--kt-primary,#0e9f6e),0 0 0 14px rgba(14,159,110,0)}
  100%{box-shadow:0 0 0 3px var(--kt-primary,#0e9f6e),0 0 0 6px rgba(14,159,110,.28)}
}
[data-kfocus-hit="1"]{
  position:relative;z-index:40;border-radius:14px;
  animation:k-focus-pulse 1.6s ease-in-out infinite;
  scroll-margin-top:120px;scroll-margin-bottom:120px;
}
[data-kfocus-hit="1"]::after{
  content:attr(data-kfocus-label);position:absolute;inset-inline-start:8px;top:8px;z-index:41;
  background:var(--kt-primary,#0e9f6e);color:#fff;font-size:12px;font-weight:800;line-height:1.5;
  padding:2px 8px;border-radius:999px;pointer-events:none;
}
`;

/** يقرأ المعامل من الرابط الحالي بلا الاعتماد على أنواع المسارات. */
function readFocus(): { selector: string; label: string } | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("kfocus");
  if (!raw) return null;
  const [kind, ...rest] = raw.split(":");
  const value = rest.join(":").trim();
  if (!value) return null;
  /* لا نبني محدّدًا من نص حر: نهرّب القيمة عبر CSS.escape. */
  const safe = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : null;
  if (!safe) return null;
  if (kind === "block") return { selector: `[data-kblock="${safe}"]`, label: "هذه الكتلة" };
  if (kind === "slot") return { selector: `[data-kslot="${safe}"]`, label: value };
  return null;
}

export function FocusHighlightLayer() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const focus = readFocus();
    if (!focus) return;
    setActive(true);

    let stop = false;
    let host: HTMLElement | null = null;
    let tries = 0;

    /* المحتوى المؤجّل قد يظهر بعد ثانية أو اثنتين ⇒ نحاول حتى ١٠ ثوانٍ. */
    const tick = () => {
      if (stop) return;
      host = document.querySelector(focus.selector) as HTMLElement | null;
      if (host) {
        host.setAttribute("data-kfocus-hit", "1");
        host.setAttribute("data-kfocus-label", focus.label);
        host.scrollIntoView({ behavior: "smooth", block: "center" });
        window.parent?.postMessage({ type: "kfocus:found" }, "*");
        return;
      }
      if (++tries > 40) {
        window.parent?.postMessage({ type: "kfocus:missing" }, "*");
        return;
      }
      window.setTimeout(tick, 250);
    };
    const timer = window.setTimeout(tick, 400);

    return () => {
      stop = true;
      window.clearTimeout(timer);
      host?.removeAttribute("data-kfocus-hit");
      host?.removeAttribute("data-kfocus-label");
    };
  }, []);

  if (!active) return null;
  return <style dangerouslySetInnerHTML={{ __html: PULSE_CSS }} />;
}
