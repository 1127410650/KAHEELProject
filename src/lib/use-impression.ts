/**
 * ظهور فعلي داخل الشاشة — لا مجرد وجود في الـ DOM.
 *
 * القاعدة: حدث `*.impression` يُرسل مرة واحدة لكل بطاقة في مشاهدة الصفحة
 * الواحدة، وبعد بقاء نصف البطاقة داخل الشاشة مدة كافية (600ms) حتى لا يُحسب
 * التمرير السريع ظهورًا. أسطح الإدارة مستثناة تمامًا: إحصاءات المالك يجب أن
 * تعكس زوّار السوق لا عمل الفريق.
 */
import { useEffect, useRef } from "react";

import { track } from "@/lib/track";

const DWELL_MS = 600;
const VISIBLE_RATIO = 0.5;

/** مفاتيح ما ظهر بالفعل: `المسار|المعرّف` — يمنع التكرار عند إعادة التركيب. */
const seen = new Set<string>();

/** أسطح لا تُقاس: الإدارة والاستوديو وأي مسار داخلي للفريق. */
function isExcludedSurface(): boolean {
  if (typeof window === "undefined") return true;
  const p = window.location.pathname;
  return p.startsWith("/admin") || p.startsWith("/studio") || p.startsWith("/dashboard");
}

export function useImpression(options: {
  name: string;
  entityKind: string;
  entityId: string | null | undefined;
  surface?: string;
  enabled?: boolean;
}) {
  const { name, entityKind, entityId, surface, enabled = true } = options;
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled || !entityId) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (isExcludedSurface()) return;

    const key = `${window.location.pathname}|${entityKind}|${entityId}`;
    if (seen.has(key)) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const clear = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= VISIBLE_RATIO) {
            if (timer) continue;
            timer = setTimeout(() => {
              timer = null;
              if (seen.has(key)) return;
              seen.add(key);
              track({
                name,
                entity_kind: entityKind,
                entity_id: entityId,
                ...(surface ? { surface } : {}),
              });
              observer.disconnect();
            }, DWELL_MS);
          } else {
            clear();
          }
        }
      },
      { threshold: [0, VISIBLE_RATIO, 1] },
    );

    observer.observe(node);
    return () => {
      clear();
      observer.disconnect();
    };
  }, [name, entityKind, entityId, surface, enabled]);

  return ref;
}
