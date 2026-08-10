/**
 * لوحة «حجزك القادم» المصغّرة على مدخل كَحيل عقار.
 *
 * تظهر لأصحاب حجز قادم فقط: العقار، التواريخ، العدّاد، وحالة الطلب — مع اختصار
 * إلى صفحة الطلبات والمحادثة. عرض فقط: القراءة تُمرَّر من الأعلى.
 */

import { Link } from "@tanstack/react-router";
import { CalendarDays, ChevronLeft, Clock, MessagesSquare, X } from "lucide-react";
import { useState } from "react";

import { AQAR_TYPE_LABELS } from "@/lib/aqar-imagery";
import { formatDate } from "@/lib/format";
import {
  AQAR_BOOKING_STATUS_LABELS,
  daysUntil,
  nightsBetween,
  type AqarBookingRow,
} from "@/lib/mkt-aqar-booking";

function countdownText(row: AqarBookingRow): string | null {
  if (!row.check_in) return null;
  const days = daysUntil(row.check_in);
  if (days > 1) return `بعد ${days.toLocaleString("en-US")} أيام`;
  if (days === 1) return "غدًا";
  if (days === 0) return "اليوم";
  if (row.check_out && daysUntil(row.check_out) >= 0) return "إقامة جارية";
  return null;
}

export function AqarUpcomingSheet({ row }: { row: AqarBookingRow }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  const listing = row.listing;
  const nights = nightsBetween(row.check_in, row.check_out);
  const countdown = countdownText(row);

  return (
    <section
      aria-label="حجزك القادم"
      className="mx-4 mt-4 rounded-[var(--r-card)] border border-primary/25 bg-card p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="k-pill px-3 py-0.5 text-nav font-bold">حجزك القادم</span>
        <div className="flex items-center gap-1">
          {countdown ? (
            <span className="rounded-full bg-secondary px-3 py-1 text-nav font-bold text-secondary-foreground">
              {countdown}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setHidden(true)}
            aria-label="إخفاء لوحة الحجز القادم"
            className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {listing ? (
        <Link
          to="/aqar/$id"
          params={{ id: listing.id }}
          className="mt-2 block text-title font-bold text-foreground"
        >
          {listing.title}
        </Link>
      ) : (
        <strong className="mt-2 block text-title font-bold text-foreground">عقار محذوف</strong>
      )}
      {listing ? (
        <p className="text-desc text-muted-foreground">
          {AQAR_TYPE_LABELS[listing.property_type] ?? "عقار"} • {listing.city}
          {listing.district ? ` — ${listing.district}` : ""}
        </p>
      ) : null}

      <ul className="mt-2 space-y-1 text-desc text-foreground">
        {row.check_in ? (
          <li className="flex items-center gap-1">
            <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
            <bdi>
              {formatDate(row.check_in)}
              {row.check_out ? ` → ${formatDate(row.check_out)}` : ""}
              {nights > 0 ? ` • ${nights.toLocaleString("en-US")} ليالٍ` : ""}
            </bdi>
          </li>
        ) : null}
        <li className="flex items-center gap-1 text-muted-foreground">
          <Clock className="size-4 shrink-0" aria-hidden />
          {AQAR_BOOKING_STATUS_LABELS[row.status]}
          {row.extended_at ? " • تم التمديد" : ""}
        </li>
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to="/aqar/requests"
          className="inline-flex items-center gap-1 rounded-full bg-primary px-4 text-desc font-bold text-primary-foreground"
          style={{ minHeight: 44 }}
        >
          تفاصيل الطلب
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
        <Link
          to="/aqar/chats"
          className="inline-flex items-center gap-1 rounded-full border border-border px-4 text-desc font-bold text-foreground"
          style={{ minHeight: 44 }}
        >
          <MessagesSquare className="size-4 text-primary" aria-hidden />
          محادثة المعلن
        </Link>
      </div>
    </section>
  );
}
