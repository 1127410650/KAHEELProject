/**
 * بوابة وضع التحرير البصري — الجزء الوحيد المُحمَّل دائمًا (بضعة أسطر).
 *
 * لا شيء يُحمَّل من الوضع إلا إذا طلبه المدير من لوحة الإدارة (علم في
 * `sessionStorage`) **و** أكّدت القاعدة أنه مدير منصة (`mkt_is_platform_admin`).
 * الزائر العادي لا يستوفي الشرط الأول أصلًا، فلا تُطلب حزمة الوضع إطلاقًا.
 */
import { Suspense, lazy, useEffect, useState } from "react";

const LiveEditOverlay = lazy(() => import("@/components/marketplace/live-edit/LiveEditOverlay"));

export function LiveEditGate() {
  const [state, setState] = useState<"off" | "on">("off");

  useEffect(() => {
    let alive = true;
    let flag = false;
    try {
      flag = sessionStorage.getItem("kaheel.liveEdit") === "1";
    } catch {
      flag = false;
    }
    if (!flag) return;
    void (async () => {
      // التحقق خادمي: العلم المحلي وحده لا يفتح الوضع.
      const { verifyPlatformAdmin } = await import("@/lib/mkt-live-edit");
      const ok = await verifyPlatformAdmin();
      if (alive && ok) setState("on");
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (state === "off") return null;
  return (
    <Suspense fallback={null}>
      <LiveEditOverlay onExit={() => setState("off")} />
    </Suspense>
  );
}
