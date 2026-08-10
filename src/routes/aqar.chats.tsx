/**
 * محادثات كَحيل عقار — بطاقة الحجز الحالية مثبَّتة أعلى الصفحة، ثم رابط مركز
 * المحادثات. البطاقة تُذكّر الطرفين بسياق الطلب (العقار، التواريخ، الحالة).
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MessagesSquare, Pin } from "lucide-react";

import { AqarShell } from "@/components/marketplace/aqar/AqarShell";
import { Skeleton } from "@/components/ui/skeleton";
import { AQAR_TYPE_LABELS } from "@/lib/aqar-imagery";
import {
  AQAR_BOOKING_STATUS_LABELS,
  fetchMyAqarBookings,
  isUpcomingBooking,
} from "@/lib/mkt-aqar-booking";
import { formatDate } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/aqar/chats")({
  head: () => ({
    meta: [
      { title: "المحادثات — كَحيل عقار" },
      {
        name: "description",
        content: "محادثاتك مع معلني العقارات على كَحيل، مع بطاقة الحجز الحالية مثبّتة للسياق.",
      },
      { property: "og:title", content: "المحادثات — كَحيل عقار" },
      { property: "og:description", content: "تواصل مباشر مع معلني العقارات على كَحيل عقار." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AqarChatsPage,
});

function AqarChatsPage() {
  const session = useQuery({
    queryKey: ["auth", "session-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });
  const bookings = useQuery({
    queryKey: ["aqar", "my-bookings"],
    queryFn: fetchMyAqarBookings,
    enabled: Boolean(session.data),
  });

  const pinned = (bookings.data ?? []).filter(isUpcomingBooking)[0] ?? null;

  return (
    <AqarShell title="المحادثات" subtitle="مع معلني العقارات" back="/aqar" backLabel="عقار">
      <div className="mx-auto w-full max-w-3xl p-4 pb-10">
        {session.data && bookings.isPending ? (
          <Skeleton className="h-28 w-full rounded-[var(--r-card)]" />
        ) : pinned ? (
          <section className="rounded-[var(--r-card)] border-2 border-primary/30 bg-card p-4">
            <p className="flex items-center gap-1 text-nav font-bold text-primary">
              <Pin className="size-4" aria-hidden />
              بطاقة الحجز المثبّتة
            </p>
            <div className="mt-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                {pinned.listing ? (
                  <Link
                    to="/aqar/$id"
                    params={{ id: pinned.listing.id }}
                    className="block truncate text-title font-bold text-foreground"
                  >
                    {pinned.listing.title}
                  </Link>
                ) : (
                  <strong className="block text-title font-bold text-foreground">عقار محذوف</strong>
                )}
                <p className="text-desc text-muted-foreground">
                  {pinned.listing
                    ? `${AQAR_TYPE_LABELS[pinned.listing.property_type] ?? "عقار"} • ${pinned.listing.city}`
                    : ""}
                </p>
                {pinned.check_in ? (
                  <p className="mt-1 flex items-center gap-1 text-desc text-foreground">
                    <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
                    {formatDate(pinned.check_in)}
                    {pinned.check_out ? ` → ${formatDate(pinned.check_out)}` : ""}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-nav font-bold text-secondary-foreground">
                {AQAR_BOOKING_STATUS_LABELS[pinned.status]}
              </span>
            </div>
            <Link
              to="/aqar/requests"
              className="mt-3 inline-flex items-center rounded-full border border-border px-3 text-desc font-bold text-foreground"
              style={{ minHeight: 44 }}
            >
              تفاصيل الطلب
            </Link>
          </section>
        ) : null}

        <div className="mt-4 flex flex-col items-center gap-2 rounded-[var(--r-card)] border border-border bg-card p-6 text-center">
          <MessagesSquare className="size-8 text-primary" aria-hidden />
          <p className="text-body text-foreground">
            محادثاتك مع المعلنين تجري في مركز محادثات كَحيل، ويبقى سياق الطلب مثبّتًا هنا.
          </p>
          <Link
            to="/my/messages"
            className="inline-flex items-center rounded-full bg-primary px-5 text-body font-bold text-primary-foreground"
            style={{ minHeight: 44 }}
          >
            فتح مركز المحادثات
          </Link>
        </div>
      </div>
    </AqarShell>
  );
}
