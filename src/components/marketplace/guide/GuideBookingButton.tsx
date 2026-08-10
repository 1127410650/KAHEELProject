/**
 * «حجز موعد» for a directory entity.
 *
 * The button records the intent in this project's own table, then behaves by
 * ownership state: while the entity's owner has not registered, the visitor is
 * handed to the entity's WhatsApp with a ready message; once an owner claim is
 * approved, the same button opens the in-platform booking flow for that page.
 */
import { useEffect, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";

import {
  bookingMessage,
  isClaimed,
  recordBookingIntent,
  whatsappWithText,
} from "@/lib/mkt-guide-booking";
import type { GuidePlace } from "@/lib/mkt-guide-places";

export function GuideBookingButton({ place }: { place: GuidePlace }) {
  const [claimed, setClaimed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void isClaimed(place.id).then((value) => {
      if (alive) setClaimed(value);
    });
    return () => {
      alive = false;
    };
  }, [place.id]);

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    const message = bookingMessage(place);
    const link = whatsappWithText(place.whatsapp_link || place.whatsapp || place.phone, message);

    try {
      await recordBookingIntent({
        place,
        channel: claimed ? "internal" : "whatsapp",
        ownerClaimed: claimed,
      });
    } catch {
      /* the intent log must never block the visitor */
    }

    if (claimed) {
      toast.success("تم تسجيل طلب الحجز — ستصلك رسالة من الجهة داخل المنصة.");
    } else if (link) {
      window.open(link, "_blank", "noopener,noreferrer");
    } else {
      toast.info("لا يوجد رقم واتساب لهذه الجهة — جرّب الاتصال أو الموقع الإلكتروني.");
    }
    setBusy(false);
  };

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      className="k-press inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-primary to-primary/80 px-4 py-[var(--sp-3)] text-desc font-black text-primary-foreground shadow-sm sm:w-auto"
    >
      <CalendarPlus className="size-4" aria-hidden />
      حجز موعد
    </button>
  );
}
