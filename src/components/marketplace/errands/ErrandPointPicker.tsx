/**
 * منتقي نقطة (استلام أو تسليم) لخدمة «جيب لي».
 *
 * ثلاث طرق للتحديد، بلا خرائط ثقيلة وبلا أي مكتبة خارجية:
 *  ١) عنوان محفوظ من دفتر عناوين المستخدم (`mkt_user_addresses`).
 *  ٢) موقع الجهاز عبر GPS — يُخزَّن كإحداثيات مع وصف مختصر.
 *  ٣) كتابة حرّة للعنوان (اسم مختصر + وصف يوصل الكابتن).
 *
 * لا يكتب هذا المكوّن أي شيء في قاعدة البيانات: يرفع النقطة المختارة للأعلى
 * فقط، والحفظ يحدث مرة واحدة عند إنشاء الطلب.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, LocateFixed, MapPin } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/session";
import { loadMyAddresses, requestDeviceLocation } from "@/lib/mkt-addresses";
import type { ErrandPoint } from "@/lib/mkt-errands";

export function ErrandPointPicker({
  title,
  hint,
  value,
  onChange,
  ar,
}: {
  title: string;
  hint: string;
  value: ErrandPoint | null;
  onChange: (point: ErrandPoint | null) => void;
  ar: boolean;
}) {
  const { session } = useSession();
  const [locating, setLocating] = useState(false);

  const addresses = useQuery({
    queryKey: ["mkt", "my-addresses", session?.user.id ?? null],
    enabled: !!session,
    staleTime: 60_000,
    queryFn: loadMyAddresses,
  });

  async function useDevice() {
    setLocating(true);
    try {
      const position = await requestDeviceLocation();
      onChange({
        label: ar ? "موقعي الحالي" : "My current location",
        details: value?.details ?? null,
        lat: position.lat,
        lng: position.lng,
      });
      toast.success(ar ? "تم تحديد موقعك من الجهاز." : "Location captured from your device.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : ar
            ? "تعذّر تحديد الموقع."
            : "Could not get your location.",
      );
    } finally {
      setLocating(false);
    }
  }

  return (
    <div className="rounded-[var(--r-card)] border border-border/70 bg-card/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-foreground">{title}</p>
          <p className="text-desc text-muted-foreground">{hint}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={useDevice}
          disabled={locating}
          className="h-8 shrink-0 gap-1 text-desc"
        >
          {locating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LocateFixed className="h-3.5 w-3.5" />
          )}
          {ar ? "موقعي الآن" : "Use GPS"}
        </Button>
      </div>

      {(addresses.data?.length ?? 0) > 0 ? (
        <div className="mb-2 flex flex-wrap gap-[var(--sp-2)]">
          {addresses.data!.slice(0, 6).map((address) => {
            const active = value?.label === address.label;
            return (
              <button
                key={address.id}
                type="button"
                onClick={() =>
                  onChange({
                    label: address.label,
                    details: [address.district, address.details].filter(Boolean).join(" — ") || null,
                    lat: address.lat,
                    lng: address.lng,
                  })
                }
                className={`inline-flex items-center gap-1 rounded-full border px-[var(--sp-3)] py-1 text-desc transition ${
                  active
                    ? "border-primary bg-primary/10 font-bold text-primary"
                    : "border-border/70 bg-background text-muted-foreground hover:border-primary/50"
                }`}
              >
                <MapPin className="h-3 w-3" />
                {address.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="grid gap-2">
        <div className="grid gap-1">
          <Label className="text-desc text-muted-foreground">
            {ar ? "اسم المكان" : "Place name"}
          </Label>
          <Input
            value={value?.label ?? ""}
            maxLength={60}
            onChange={(event) =>
              onChange({
                label: event.target.value,
                details: value?.details ?? null,
                lat: value?.lat ?? null,
                lng: value?.lng ?? null,
              })
            }
            placeholder={ar ? "مثال: البيت — دوار المحافظة" : "e.g. Home — main square"}
            className="h-9 text-sm"
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-desc text-muted-foreground">
            {ar ? "وصف يوصل الكابتن" : "Directions for the captain"}
          </Label>
          <Textarea
            value={value?.details ?? ""}
            maxLength={300}
            rows={2}
            onChange={(event) =>
              onChange({
                label: value?.label ?? "",
                details: event.target.value,
                lat: value?.lat ?? null,
                lng: value?.lng ?? null,
              })
            }
            placeholder={
              ar ? "الشارع، البناء، الطابق، علامة مميزة…" : "Street, building, floor, landmark…"
            }
            className="resize-none text-sm"
          />
        </div>
      </div>

      {value?.lat != null && value?.lng != null ? (
        <p className="mt-2 text-desc font-semibold text-primary">
          {ar ? "مربوط بإحداثيات الجهاز ✓" : "Pinned to device coordinates ✓"}
        </p>
      ) : null}
    </div>
  );
}
