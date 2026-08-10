/**
 * طبقة وضع التحرير البصري: الشريط العلوي، توهّج الفتحات المسجّلة، ومعاينة
 * المسوّدات للمدير وحده.
 *
 * الفتحات تُكتشف من سمة `data-kslot` الموجودة أصلًا في الواجهة — لا رسم حر ولا
 * حقن CSS من المستخدم، والعناصر غير المسجّلة لا تتوهّج ولا تُعدَّل. هذا الملف
 * يُحمَّل ككود مؤجّل من `LiveEditGate` فلا يصل إلى الزائر العادي إطلاقًا.
 */
import { useEffect, useState } from "react";
import { PanelsTopLeft, X } from "lucide-react";

import { LiveEditSheet } from "@/components/marketplace/live-edit/LiveEditSheet";
import { slotStyleCss, useMediaSlots, type MediaSlot } from "@/lib/mkt-media-slots";
import { requestLiveEdit, useSlotDrafts, type SlotPatch } from "@/lib/mkt-live-edit";

/** توهّج الفتحات + اسم المعرّف عند المرور أو اللمس. */
const OUTLINE_CSS = `
[data-kslot]{cursor:pointer}
[data-kslot]:hover,[data-kslot]:focus-visible,[data-kslot][data-kslot-active="1"]{
  outline:2px dashed #8a4fff;outline-offset:-2px;position:relative}
[data-kslot]:hover::after,[data-kslot][data-kslot-active="1"]::after{
  content:attr(data-kslot);position:absolute;inset-inline-start:4px;top:4px;z-index:60;
  background:#3d2179;color:#fff;font-size:12px;font-weight:800;line-height:1.4;
  padding:2px 6px;border-radius:8px;pointer-events:none;direction:ltr}
`;

export default function LiveEditOverlay({ onExit }: { onExit: () => void }) {
  const slots = useMediaSlots();
  const drafts = useSlotDrafts(true);
  const [openKey, setOpenKey] = useState<string | null>(null);

  /* الضغط على أي فتحة يفتح لوحتها ولا يُنفّذ الرابط أسفلها. */
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const host = target?.closest?.("[data-kslot]") as HTMLElement | null;
      if (!host) return;
      if (target?.closest?.("[data-kslot-ui]")) return;
      event.preventDefault();
      event.stopPropagation();
      setOpenKey(host.getAttribute("data-kslot"));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const draftMap = new Map<string, SlotPatch>(
    (drafts.data ?? []).map((row) => [row.slot_key, row.patch]),
  );

  /* معاينة قبل النشر: أنماط المسوّدة تُطبَّق في متصفح المدير فقط. */
  const previewCss = (slots.data ?? [])
    .map((slot) => {
      const patch = draftMap.get(slot.slot_key);
      if (!patch) return null;
      return slotStyleCss({ ...slot, ...patch } as MediaSlot);
    })
    .filter((rule): rule is string => !!rule)
    .join("\n");

  const slot = openKey ? (slots.data ?? []).find((item) => item.slot_key === openKey) : undefined;

  return (
    <>
      <style>{OUTLINE_CSS}</style>
      {previewCss ? <style>{previewCss}</style> : null}

      <div
        data-kslot-ui
        dir="rtl"
        className="fixed inset-x-0 top-0 z-[70] flex items-center justify-between gap-2 bg-[#3d2179] px-3 py-[var(--sp-2)] text-white"
      >
        <span className="flex min-w-0 items-center gap-[var(--sp-2)] text-desc font-extrabold">
          <PanelsTopLeft className="size-4 shrink-0" aria-hidden />
          <span className="truncate">
            وضع التحرير نشط — اضغط أي عنصر متوهّج لتعديله
            {draftMap.size > 0 ? ` · مسوّدات: ${draftMap.size}` : ""}
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            requestLiveEdit(false);
            onExit();
          }}
          className="inline-flex min-h-[32px] shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 text-desc font-bold"
        >
          <X className="size-4" aria-hidden /> خروج
        </button>
      </div>

      {slot ? (
        <div data-kslot-ui>
          <LiveEditSheet
            slot={slot}
            draft={draftMap.get(slot.slot_key)}
            onClose={() => setOpenKey(null)}
          />
        </div>
      ) : null}
    </>
  );
}
