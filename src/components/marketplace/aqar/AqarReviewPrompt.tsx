/**
 * تلميح تقييم ما بعد الإقامة — يبقى ظاهرًا حتى يقيّم العميل فعلًا.
 *
 * لا «تجاهل نهائي»: زر «لاحقًا» يخفيه لهذه الجلسة فقط، فالتلميح يعود في الزيارة
 * التالية ما لم يُرسَل التقييم. الكتابة عبر `submitAqarReview` (SECURITY DEFINER).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import type { AqarBookingRow } from "@/lib/mkt-aqar-booking";
import { AQAR_REVIEW_TAGS, submitAqarReview } from "@/lib/mkt-aqar-reviews";

const SESSION_KEY = "kaheel.aqar.reviewLater";

/** إخفاء مؤقت لهذه الجلسة فقط — لا تجاهل دائم. */
function laterFor(bookingId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === bookingId;
  } catch {
    return false;
  }
}

export function AqarReviewPrompt({ row }: { row: AqarBookingRow }) {
  const queryClient = useQueryClient();
  const [hidden, setHidden] = useState(() => laterFor(row.id));
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");

  const submit = useMutation({
    mutationFn: () =>
      submitAqarReview({ bookingId: row.id, rating, tags, comment }),
    onSuccess: () => {
      toast.success("شكرًا لك — نُشر تقييمك.");
      setHidden(true);
      void queryClient.invalidateQueries({ queryKey: ["aqar", "reviewed-bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["aqar", "ratable-booking"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (hidden) return null;

  const later = () => {
    try {
      window.sessionStorage.setItem(SESSION_KEY, row.id);
    } catch {
      /* التخزين قد يكون معطّلًا — الإخفاء يبقى في الذاكرة فقط */
    }
    setHidden(true);
  };

  return (
    <section
      aria-label="تقييم إقامتك"
      className="mx-4 mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="flex items-start gap-2">
        <Star className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0">
          <strong className="block text-title font-bold text-foreground">كيف كانت إقامتك؟</strong>
          <p className="text-desc text-muted-foreground">
            {row.listing?.title ?? "إقامتك السابقة"}
            {row.check_out ? (
              <>
                {" — انتهت "}
                <bdi>{formatDate(row.check_out)}</bdi>
              </>
            ) : null}
          </p>
        </div>
      </div>

      {/* النجوم — أهداف لمس 44px */}
      <div className="mt-3 flex items-center gap-1" role="radiogroup" aria-label="عدد النجوم">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={`${value.toLocaleString("en-US")} من 5`}
            onClick={() => {
              setRating(value);
              setOpen(true);
            }}
            className="inline-flex size-11 items-center justify-center rounded-full"
          >
            <Star
              className={`size-6 ${value <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`}
              aria-hidden
            />
          </button>
        ))}
      </div>

      {open ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {AQAR_REVIEW_TAGS.map((tag) => {
              const active = tags.includes(tag.key);
              return (
                <button
                  key={tag.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setTags((prev) =>
                      prev.includes(tag.key)
                        ? prev.filter((key) => key !== tag.key)
                        : [...prev, tag.key],
                    )
                  }
                  className={`rounded-full border px-4 text-desc font-bold ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-foreground"
                  }`}
                  style={{ minHeight: 44 }}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="تعليق اختياري للمعلن والزوّار"
            aria-label="تعليق التقييم"
            className="mt-3 text-body"
            rows={3}
          />
        </>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          style={{ minHeight: 44 }}
          disabled={rating < 1 || submit.isPending}
          onClick={() => submit.mutate()}
        >
          إرسال التقييم
        </Button>
        <Button variant="outline" style={{ minHeight: 44 }} onClick={later}>
          لاحقًا
        </Button>
      </div>
    </section>
  );
}
