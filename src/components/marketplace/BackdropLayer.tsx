/**
 * طبقة خلفية اليوم.
 *
 * الأداء أولوية: عنصر `<img>` واحد بأبعاد صريحة (١٦٠٠×٩٠٦) داخل حاوية ثابتة
 * `fixed inset-0` خارج مجرى التخطيط تمامًا، فلا يوجد ما يُدفع ولا هزّة تخطيط
 * حتى لو تأخّرت الصورة. لا يُطلب سوى ملف اليوم الواحد.
 *
 * فوق الصورة طبقتا تدرّج (بيضاء من الأعلى وحجاب خفيف على العموم) تضمنان بقاء
 * كل نص فوقها مقروءًا مهما كانت الخلفية غامقة أو فاتحة. الحاوية
 * `pointer-events-none` و`aria-hidden` فلا تعترض تفاعلًا ولا تُنطق.
 *
 * الظهور بتلاشٍ خفيف على `opacity` فقط، ويُلغى كليًا مع
 * `prefers-reduced-motion`.
 */
import { useEffect, useState } from "react";

import { BACKDROP_HEIGHT, BACKDROP_WIDTH, useDailyBackdrop } from "@/lib/mkt-backdrops";

export function BackdropLayer() {
  const { backdrop } = useDailyBackdrop();
  const [loaded, setLoaded] = useState(false);

  // تفعيل شفافية المحتوى فقط عندما توجد خلفية فعلية.
  useEffect(() => {
    const shell = document.querySelector(".market-shell");
    if (!shell || !backdrop) return;
    shell.classList.add("k-has-backdrop");
    return () => shell.classList.remove("k-has-backdrop");
  }, [backdrop]);

  if (!backdrop) return null;

  return (
    <div aria-hidden className="k-backdrop-layer pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <img
        src={backdrop.url}
        alt=""
        width={BACKDROP_WIDTH}
        height={BACKDROP_HEIGHT}
        decoding="async"
        fetchPriority="low"
        onLoad={() => setLoaded(true)}
        className={`h-full w-full object-cover transition-opacity duration-500 motion-reduce:transition-none ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={
          backdrop.tone === "dark"
            ? "absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255/0.78)_0%,rgb(255_255_255/0.66)_38%,rgb(255_255_255/0.80)_100%)]"
            : "absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255/0.70)_0%,rgb(255_255_255/0.58)_38%,rgb(255_255_255/0.74)_100%)]"
        }
      />
    </div>
  );
}
