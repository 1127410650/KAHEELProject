/**
 * طبقة أنماط الفتحات: تطبّق مظهر الفتحات المنشور (لون خلفية أو تدرّج) على
 * العناصر التي تحمل `data-kslot="..."` في الواجهة العامة.
 *
 * كل القيم تأتي من `mkt_media_slots` بعد تنقية خادمية، وتُفحص مرة أخرى في
 * `slotStyleCss` قبل الطباعة — لا يُقبل أي CSS حر. المكوّن صغير جدًا ولا يستورد
 * أي شيء من وضع التحرير، فالزائر العادي لا يحمّل شيئًا من ذلك الوضع.
 */
import { useMediaSlots, slotStyleCss } from "@/lib/mkt-media-slots";

export function SlotStyleLayer() {
  const slots = useMediaSlots();
  const css = (slots.data ?? [])
    .map((slot) => slotStyleCss(slot))
    .filter((rule): rule is string => !!rule)
    .join("\n");
  if (!css) return null;
  return <style data-kaheel-slot-styles>{css}</style>;
}
