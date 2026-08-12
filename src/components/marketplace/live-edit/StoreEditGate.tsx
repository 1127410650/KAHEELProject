/**
 * محرر صفحة المتجر لصاحبه (click-to-edit مُقيَّد بالنطاق).
 *
 * الظهور يستند إلى تحقّق خادمي واحد: `mkt_owns_storefront(id)` في القاعدة —
 * لا فحص واجهة ولا تخزين محلي. وحتى لو ظهرت اللوحة بحيلة، كل حفظ يمرّ بدالة
 * `mkt_store_design_save` التي:
 *   - ترفض أي فتحة نطاقها `functional` (حجز/مطابقة/دفع/مسافة) بـ
 *     `FUNCTIONAL_SLOT_IMMUTABLE` — لأي مستدعٍ بلا استثناء،
 *   - وترفض أي متجر لا يملكه المستدعي بـ `NOT_STORE_OWNER`.
 *
 * فصاحب المتجر يرى ويعدّل عناصر صفحته وحدها، ولا يرى صفحة متجر آخر إطلاقًا.
 */
import { useEffect, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Lock, PencilRuler, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import {
  studioError,
  studioText,
  useEditableSlots,
  useSaveStoreDesign,
  useStoreDesign,
  type EditableSlot,
  type StorePatch,
} from "@/lib/mkt-studio";

function useOwnsStore(storefrontId: string) {
  return useQuery({
    queryKey: ["mkt", "owns-storefront", storefrontId],
    staleTime: 60_000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc(
        "mkt_owns_storefront" as never,
        { _storefront_id: storefrontId } as never,
      );
      if (error) return false;
      return data === true;
    },
  });
}

function SlotForm({
  slot,
  storefrontId,
  initial,
  onDone,
}: {
  slot: EditableSlot;
  storefrontId: string;
  initial: StorePatch;
  onDone: () => void;
}) {
  const save = useSaveStoreDesign();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(slot.fields.map((field) => [field, String(initial[field] ?? "")])),
  );

  if (slot.scope === "functional") {
    return (
      <p className="flex items-start gap-[var(--sp-2)] text-body text-foreground">
        <Lock className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        هذا مكوّن وظيفي مشترك (حجز/مطابقة/دفع/حساب مسافة) — ثابت ولا يُعدَّل من أي حساب، بما في ذلك
        صاحب المتجر ومالك المنصة.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {slot.fields.map((field) => (
        <div key={field} className="space-y-1">
          <Label className="text-desc" dir="ltr">
            {field}
          </Label>
          <Input
            value={values[field] ?? ""}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, [field]: studioText(event.target.value) }))
            }
            style={{ minHeight: 44 }}
          />
        </div>
      ))}
      <Button
        disabled={save.isPending}
        onClick={() => {
          const patch: StorePatch = {};
          for (const field of slot.fields) {
            const value = studioText(values[field] ?? "");
            patch[field] = value === "" ? null : value;
          }
          save.mutate(
            { storefrontId, slotKey: slot.slot_key, patch },
            {
              onSuccess: () => {
                toast.success("حُفظ تعديل صفحتك");
                onDone();
              },
              onError: (error) => toast.error(studioError(error)),
            },
          );
        }}
        style={{ minHeight: 44 }}
      >
        حفظ
      </Button>
    </div>
  );
}

export function StoreEditGate({ storefrontId }: { storefrontId: string }) {
  const owns = useOwnsStore(storefrontId);
  const slots = useEditableSlots();
  const design = useStoreDesign(owns.data === true ? storefrontId : undefined);
  const [active, setActive] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  /* في وضع التحرير: الضغط على أي عنصر مسجّل يفتح لوحته الخاصة فقط. */
  useEffect(() => {
    if (!active) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const host = target?.closest?.("[data-kslot]") as HTMLElement | null;
      if (!host) return;
      if (target?.closest?.("[data-kslot-ui]")) return;
      event.preventDefault();
      event.stopPropagation();
      const key = host.getAttribute("data-kslot");
      const slot = (slots.data ?? []).find((item) => item.slot_key === key);
      if (!slot) {
        toast.info("هذا العنصر غير قابل للتعديل من صفحتك.");
        return;
      }
      if (slot.scope === "functional") {
        toast.error("مكوّن وظيفي مشترك — ثابت ولا يُعدَّل.");
        return;
      }
      if (slot.scope !== "store") {
        toast.error("هذا العنصر يُدار من مدير المنصة.");
        return;
      }
      setOpenKey(slot.slot_key);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [active, slots.data]);

  if (owns.data !== true) return null;

  const slot = openKey ? (slots.data ?? []).find((item) => item.slot_key === openKey) : undefined;

  return (
    <>
      {active ? (
        <style>{`[data-kslot]{outline:2px dashed var(--primary);outline-offset:-2px;cursor:pointer}`}</style>
      ) : null}

      <div data-kslot-ui className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-3">
        <Button
          size="sm"
          variant={active ? "secondary" : "default"}
          className="gap-[var(--sp-2)] shadow-lg"
          onClick={() => setActive((value) => !value)}
          style={{ minHeight: 44 }}
        >
          {active ? <X className="size-4" aria-hidden /> : <PencilRuler className="size-4" aria-hidden />}
          {active ? "إنهاء تعديل صفحتي" : "تعديل صفحتي"}
        </Button>
      </div>

      {slot ? (
        <div data-kslot-ui>
          <Sheet open onOpenChange={() => setOpenKey(null)}>
            <SheetContent side="bottom" dir="rtl" className="max-h-[85vh] overflow-auto">
              <SheetTitle className="text-section font-extrabold">{slot.label_ar}</SheetTitle>
              <div className="mt-3">
                <SlotForm
                  slot={slot}
                  storefrontId={storefrontId}
                  initial={(design.data ?? {})[slot.slot_key] ?? {}}
                  onDone={() => setOpenKey(null)}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      ) : null}
    </>
  );
}
