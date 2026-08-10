/**
 * طبقة أنماط الفتحات: تطبّق مظهر الفتحات المنشور (لون خلفية أو تدرّج، شكل
 * زخرفي، حركة) على العناصر التي تحمل `data-kslot="..."` في الواجهة العامة.
 *
 * كل القيم تأتي من القاعدة بعد تنقية خادمية وتُفحص مرة أخرى قبل الطباعة — لا
 * يُقبل أي CSS أو HTML حر. مكتبة الأشكال لا تُطلب إلا إذا كانت هناك فتحة تستخدم
 * شكلًا أو حركة فعلًا، والحركة محدودة بثلاثة عناصر (`slotsCss`). المكوّن لا
 * يستورد شيئًا من وضع التحرير، فالزائر العادي لا يحمّل شيئًا منه.
 */
import { needsDesignLibrary, slotsCss, useDesignLibrary } from "@/lib/mkt-design-library";
import { useMediaSlots } from "@/lib/mkt-media-slots";

export function SlotStyleLayer() {
  const slots = useMediaSlots();
  const lib = useDesignLibrary(needsDesignLibrary(slots.data));
  const css = slotsCss(slots.data ?? [], lib.data);
  if (!css) return null;
  return <style data-kaheel-slot-styles>{css}</style>;
}
