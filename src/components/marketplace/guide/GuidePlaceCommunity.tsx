/**
 * Guide place community block: gallery, ratings, customer uploads, ownership
 * claim and promotion — the Google-Maps-style part of the detail page.
 *
 * Everything a visitor sends here lands in the admin queue as `pending`; the
 * page shows the visitor their own pending items with a clear label, and shows
 * everyone else only approved content.
 */

import { useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, Clock3, ImagePlus, Megaphone, ShieldQuestion, Star, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { useActiveAccount } from "@/lib/mkt-account";
import { useAdCreditWallet } from "@/lib/mkt-ad-credit";
import {
  CLAIM_DOC_ACCEPT,
  CLAIM_DOC_KIND_LABEL,
  CLAIM_DOC_RETENTION_DAYS,
  useSubmitGuideClaim,
} from "@/lib/mkt-guide-legal";
import {
  GUIDE_PHOTO_ACCEPT,
  GUIDE_PHOTO_BATCH_LIMIT,
  GUIDE_PROMOTION_CREDITS_PER_DAY,
  guidePhotoUrl,
  useDeleteGuidePhoto,
  useGuidePlacePhotos,
  useGuidePlaceRating,
  useGuidePlaceReviews,
  useMyGuideClaim,
  useMyGuideContributions,
  usePromoteGuidePlace,
  useSubmitGuideReview,
  useUploadGuidePhotos,
} from "@/lib/mkt-guide-community";
import { useSession } from "@/lib/session";

const UPLOAD_ERRORS: Record<string, string> = {
  type: "صيغة الصورة غير مدعومة — استخدم JPG أو PNG أو WebP.",
  tooLarge: "الصورة كبيرة جدًا ولم نتمكّن من ضغطها للحد المسموح.",
  corrupt: "تعذّر قراءة الصورة.",
};

export function GuidePlaceRating({
  average,
  total,
  size = "sm",
}: {
  average: number | null;
  total: number;
  size?: "sm" | "lg";
}) {
  if (average == null || total === 0) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 font-black ${
        size === "lg" ? "text-sm" : "text-desc"
      }`}
    >
      <Star className="size-3.5 fill-gold text-gold" aria-hidden />
      {average.toFixed(1)}
      <span className="opacity-70">({total.toLocaleString("en-US")})</span>
    </span>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex" aria-label={`${value} من 5`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <Star
          key={step}
          className={`size-3.5 ${step <= value ? "fill-gold text-gold" : "text-muted-foreground/40"}`}
          aria-hidden
        />
      ))}
    </span>
  );
}

export function GuidePlaceCommunity({
  placeId,
  placeName,
}: {
  placeId: string;
  placeName: string;
}) {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const { account } = useActiveAccount();
  const queryClient = useQueryClient();

  const photos = useGuidePlacePhotos(placeId);
  const reviews = useGuidePlaceReviews(placeId);
  const rating = useGuidePlaceRating(placeId);
  const mine = useMyGuideContributions(placeId, userId);
  const claim = useMyGuideClaim(placeId, userId);

  const [lightbox, setLightbox] = useState<string | null>(null);

  const gallery = photos.data ?? [];

  return (
    <>
      <GallerySection
        items={gallery.map((photo) => ({
          id: photo.id,
          url: guidePhotoUrl(photo.storage_path),
          kind: photo.kind,
          caption: photo.caption,
          width: photo.width,
          height: photo.height,
        }))}
        loading={photos.isLoading}
        onOpen={setLightbox}
      />

      <UploadSection placeId={placeId} userId={userId} />

      {userId && (mine.data?.photos.length ?? 0) > 0 ? (
        <MyPhotosSection
          photos={mine.data!.photos}
          onDeleted={() => {
            void queryClient.invalidateQueries({ queryKey: ["mkt", "guide-mine"] });
          }}
        />
      ) : null}

      <ReviewsSection
        placeId={placeId}
        userId={userId}
        average={rating.data?.average ?? null}
        total={rating.data?.total ?? 0}
        rows={reviews.data ?? []}
        myReview={mine.data?.review ?? null}
      />

      <PromoteSection
        placeId={placeId}
        placeName={placeName}
        userId={userId}
        accountKey={account?.account_key ?? null}
        tenantId={account?.tenant_id ?? null}
      />

      <ClaimSection placeId={placeId} userId={userId} claim={claim.data ?? null} />

      {lightbox ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-label="عرض الصورة"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="إغلاق"
            className="absolute end-4 top-4 inline-flex size-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur"
          >
            <X className="size-5" aria-hidden />
          </button>
          <img
            src={lightbox}
            alt=""
            className="max-h-[85vh] w-auto max-w-full rounded-2xl object-contain"
          />
        </div>
      ) : null}
    </>
  );
}

/* ── gallery ──────────────────────────────────────────────────────────────── */

function GallerySection({
  items,
  loading,
  onOpen,
}: {
  items: {
    id: string;
    url: string;
    kind: "official" | "customer";
    caption: string | null;
    width: number | null;
    height: number | null;
  }[];
  loading: boolean;
  onOpen: (url: string) => void;
}) {
  if (loading) {
    // Fixed skeleton height: the gallery never resizes once the photos land.
    return <div className="h-[168px] animate-pulse rounded-3xl border border-border bg-muted/40" />;
  }
  if (items.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-border/80 bg-card">
      <div className="flex snap-x gap-1.5 overflow-x-auto p-1.5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item.url)}
            className="relative h-[160px] w-[52%] shrink-0 snap-start overflow-hidden rounded-2xl bg-muted sm:w-[30%]"
          >
            <img
              src={item.url}
              alt={item.caption ?? ""}
              loading="lazy"
              decoding="async"
              width={item.width ?? 1600}
              height={item.height ?? 1200}
              className="size-full object-cover"
            />
            {item.kind === "official" ? (
              <span className="absolute bottom-1.5 start-1.5 rounded-full bg-market-navy/90 px-2 py-0.5 text-desc font-black text-white">
                صورة رسمية
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}

/* ── uploads ──────────────────────────────────────────────────────────────── */

function UploadSection({ placeId, userId }: { placeId: string; userId: string | null }) {
  const input = useRef<HTMLInputElement | null>(null);
  const upload = useUploadGuidePhotos(placeId, userId);

  return (
    <section className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5">
      <h2 className="text-section mb-1 flex items-center gap-1.5 font-black">
        <Camera className="size-4 text-market-navy" aria-hidden />
        أضف صورًا للجهة
      </h2>
      <p className="text-desc leading-6 text-muted-foreground">
        تُضغط الصور في متصفحك قبل الرفع (أقصى عرض 1600px، صيغة WebP، وحد 300KB لكل صورة) وتُراجع من
        الإدارة قبل النشر.
      </p>
      <input
        ref={input}
        type="file"
        accept={GUIDE_PHOTO_ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          if (files.length === 0) return;
          upload.mutate(files, {
            onSuccess: (saved) =>
              toast.success(`تم إرسال ${saved} صورة للمراجعة`, {
                description: "ستظهر بعد اعتماد الإدارة.",
              }),
            onError: (error) =>
              toast.error(UPLOAD_ERRORS[(error as Error).message] ?? "تعذّر رفع الصور، حاول لاحقًا."),
          });
        }}
      />
      <button
        type="button"
        disabled={!userId || upload.isPending}
        onClick={() => input.current?.click()}
        className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-2xl bg-market-navy px-4 text-desc font-black text-white disabled:opacity-50"
      >
        <ImagePlus className="size-4" aria-hidden />
        {upload.isPending ? "جاري الضغط والرفع…" : `اختر صورًا (حتى ${GUIDE_PHOTO_BATCH_LIMIT})`}
      </button>
      {!userId ? (
        <p className="mt-2 text-desc font-bold text-muted-foreground">
          سجّل الدخول لإضافة صور أو تقييم.
        </p>
      ) : null}
    </section>
  );
}

function MyPhotosSection({
  photos,
  onDeleted,
}: {
  photos: { id: string; storage_path: string; status: string; reject_reason: string | null }[];
  onDeleted: () => void;
}) {
  const remove = useDeleteGuidePhoto();
  return (
    <section className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5">
      <h2 className="text-section mb-2 font-black">صوري لهذه الجهة</h2>
      <ul className="space-y-2">
        {photos.map((photo) => (
          <li key={photo.id} className="flex items-center gap-2.5">
            <img
              src={guidePhotoUrl(photo.storage_path)}
              alt=""
              loading="lazy"
              width={56}
              height={56}
              className="size-14 shrink-0 rounded-xl object-cover"
            />
            <div className="min-w-0 flex-1 text-desc font-bold">
              {photo.status === "approved" ? (
                <span className="inline-flex items-center gap-1 text-success">
                  <CheckCircle2 className="size-3.5" aria-hidden /> معتمدة وظاهرة
                </span>
              ) : photo.status === "rejected" ? (
                <span className="text-destructive">
                  مرفوضة — {photo.reject_reason ?? "لا تتوافق مع الشروط"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-gold-dark">
                  <Clock3 className="size-3.5" aria-hidden /> قيد المراجعة
                </span>
              )}
            </div>
            <button
              type="button"
              aria-label="حذف الصورة"
              onClick={() => remove.mutate(photo.id, { onSuccess: onDeleted })}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── reviews ──────────────────────────────────────────────────────────────── */

function ReviewsSection({
  placeId,
  userId,
  average,
  total,
  rows,
  myReview,
}: {
  placeId: string;
  userId: string | null;
  average: number | null;
  total: number;
  rows: { id: string; rating: number; comment: string | null; display_name: string | null; created_at: string }[];
  myReview: { status: string; rating: number; reject_reason: string | null } | null;
}) {
  const [rating, setRating] = useState(myReview?.rating ?? 0);
  const [comment, setComment] = useState("");
  const submit = useSubmitGuideReview(placeId, userId);

  return (
    <section className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-section font-black">التقييمات والتعليقات</h2>
        <GuidePlaceRating average={average} total={total} size="lg" />
      </div>

      {userId ? (
        <div className="mb-4 rounded-2xl border border-border bg-background p-3">
          {myReview ? (
            <p className="mb-2 text-desc font-black">
              {myReview.status === "approved"
                ? "تقييمك منشور — يمكنك تعديله وسيعاد للمراجعة."
                : myReview.status === "rejected"
                  ? `تقييمك السابق مرفوض: ${myReview.reject_reason ?? "لا يتوافق مع الشروط"}`
                  : "تقييمك قيد المراجعة."}
            </p>
          ) : null}
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((step) => (
              <button
                key={step}
                type="button"
                aria-label={`${step} نجوم`}
                onClick={() => setRating(step)}
              >
                <Star
                  className={`size-6 ${step <= rating ? "fill-gold text-gold" : "text-muted-foreground/40"}`}
                  aria-hidden
                />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={2}
            maxLength={1200}
            placeholder="اكتب تجربتك مع هذه الجهة…"
            className="mt-2 w-full resize-none rounded-xl border border-input bg-background p-2.5 text-desc outline-none focus:border-market-navy"
          />
          <button
            type="button"
            disabled={rating < 1 || submit.isPending}
            onClick={() =>
              submit.mutate(
                { rating, comment },
                {
                  onSuccess: () =>
                    toast.success("تم إرسال تقييمك للمراجعة", {
                      description: "يُنشر بعد اعتماد الإدارة.",
                    }),
                  onError: () => toast.error("تعذّر إرسال التقييم، حاول لاحقًا."),
                },
              )
            }
            className="mt-2 inline-flex h-10 items-center rounded-2xl bg-market-navy px-4 text-desc font-black text-white disabled:opacity-50"
          >
            {submit.isPending ? "جاري الإرسال…" : "إرسال التقييم"}
          </button>
        </div>
      ) : (
        <p className="mb-3 text-desc font-bold text-muted-foreground">
          سجّل الدخول لكتابة تقييم.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-desc text-muted-foreground">لا تقييمات معتمدة بعد.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="border-t border-border/70 pt-3 first:border-0 first:pt-0">
              <div className="flex items-center gap-2">
                <Stars value={row.rating} />
                <span className="text-desc font-black">{row.display_name ?? "زائر"}</span>
              </div>
              {row.comment ? (
                <p className="mt-1 whitespace-pre-line text-desc leading-6 text-muted-foreground">
                  {row.comment}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ── promotion ────────────────────────────────────────────────────────────── */

function PromoteSection({
  placeId,
  placeName,
  userId,
  accountKey,
  tenantId,
}: {
  placeId: string;
  placeName: string;
  userId: string | null;
  accountKey: string | null;
  tenantId: string | null;
}) {
  const [days, setDays] = useState(7);
  const wallet = useAdCreditWallet(userId ? accountKey : null, tenantId);
  const promote = usePromoteGuidePlace(placeId, tenantId);
  const cost = days * GUIDE_PROMOTION_CREDITS_PER_DAY;

  if (!userId) return null;

  return (
    <section className="rounded-3xl border border-market-purple/30 bg-market-purple/[0.04] p-4 sm:p-5">
      <h2 className="text-section mb-1 flex items-center gap-1.5 font-black">
        <Megaphone className="size-4 text-market-purple" aria-hidden />
        روّج «{placeName}» في «إعلانات مميزة»
      </h2>
      <p className="text-desc leading-6 text-muted-foreground">
        تظهر الجهة في المساحة المميزة أسفل شريط البحث في الرئيسية. التكلفة{" "}
        {GUIDE_PROMOTION_CREDITS_PER_DAY} من رصيد الإعلانات لكل يوم.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {[3, 7, 14, 30].map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setDays(option)}
            className={`rounded-full border px-3 py-1 text-desc font-black transition ${
              days === option
                ? "border-market-purple bg-market-purple text-white"
                : "border-border bg-background"
            }`}
          >
            {option} يوم
          </button>
        ))}
        <span className="ms-auto text-desc font-black text-muted-foreground">
          رصيدك: {(wallet.data?.balance ?? 0).toLocaleString("en-US")}
        </span>
      </div>
      <button
        type="button"
        disabled={promote.isPending}
        onClick={() =>
          promote.mutate(days, {
            onSuccess: () => toast.success(`تم الترويج لمدة ${days} يوم`),
            onError: (error) =>
              toast.error(
                String((error as Error).message).includes("INSUFFICIENT")
                  ? "رصيد الإعلانات لا يكفي."
                  : "تعذّر تنفيذ الترويج.",
              ),
          })
        }
        className="mt-3 inline-flex h-10 items-center rounded-2xl bg-market-purple px-4 text-desc font-black text-white disabled:opacity-50"
      >
        {promote.isPending ? "جاري التنفيذ…" : `ترويج الآن — ${cost.toLocaleString("en-US")} رصيد`}
      </button>
    </section>
  );
}

/* ── ownership claim ──────────────────────────────────────────────────────── */

/**
 * A claim is never accepted on words alone: it needs the applicant's name, their
 * role, the account's OTP-verified login phone, and at least one document. The
 * documents go to a private bucket and the request stays `pending` until an
 * admin decides it by hand.
 */
function ClaimSection({
  placeId,
  userId,
  claim,
}: {
  placeId: string;
  userId: string | null;
  claim: { status: string; reject_reason: string | null } | null;
}) {
  const { session, profile } = useSession();
  const [open, setOpen] = useState(false);
  const [applicantName, setApplicantName] = useState("");
  const [applicantRole, setApplicantRole] = useState<"owner" | "agent">("owner");
  const [docKind, setDocKind] = useState("commercial_register");
  const [files, setFiles] = useState<File[]>([]);
  const [evidence, setEvidence] = useState("");
  const submit = useSubmitGuideClaim(placeId, userId);

  /* The login phone is already OTP-verified by the sign-in flow itself. */
  const verifiedPhone = session?.user.phone
    ? `+${session.user.phone.replace(/\D/g, "")}`
    : (profile?.phone ?? null);

  if (!userId) return null;

  const inputClass =
    "h-10 w-full rounded-xl border border-input bg-background px-3 text-desc outline-none focus:border-primary";

  return (
    <section id="guide-claim" className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5">
      <h2 className="text-section mb-1 flex items-center gap-1.5 font-black">
        <ShieldQuestion className="size-4 text-primary" aria-hidden />
        هذه جهتك؟ طالب بإدارتها
      </h2>
      {claim ? (
        <p className="text-desc font-bold text-muted-foreground">
          {claim.status === "approved"
            ? "مطالبتك معتمدة — تستطيع إدارة صور الجهة."
            : claim.status === "rejected"
              ? `المطالبة مرفوضة: ${claim.reject_reason ?? "لم تكفِ الإثباتات"}`
              : "مطالبتك قيد المراجعة — الموافقة يدوية دائمًا."}
        </p>
      ) : open ? (
        <div className="mt-2 space-y-2">
          <input
            value={applicantName}
            onChange={(event) => setApplicantName(event.target.value)}
            placeholder="اسم مقدّم الطلب"
            className={inputClass}
          />
          <div className="flex gap-2">
            {(["owner", "agent"] as const).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setApplicantRole(role)}
                className={`h-10 flex-1 rounded-xl border text-desc font-black ${
                  applicantRole === role
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                {role === "owner" ? "مالك" : "مفوّض"}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-muted/40 p-2.5">
            <p className="text-desc font-black">الجوال الموثّق</p>
            <p className="mt-0.5 text-desc font-bold text-muted-foreground">
              {verifiedPhone
                ? `${verifiedPhone} — موثّق برمز التحقق عند تسجيل الدخول`
                : "لا يوجد جوال موثّق على حسابك — أضف جوالك ووثّقه بالدخول برمز التحقق قبل تقديم المطالبة."}
            </p>
          </div>

          <select
            value={docKind}
            onChange={(event) => setDocKind(event.target.value)}
            className={inputClass}
          >
            {Object.keys(CLAIM_DOC_KIND_LABEL).map((value) => (
              <option key={value} value={value}>
                {CLAIM_DOC_KIND_LABEL[value]}
              </option>
            ))}
          </select>
          <input
            type="file"
            multiple
            accept={CLAIM_DOC_ACCEPT}
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            className="w-full rounded-xl border border-input bg-background p-2 text-desc"
          />
          <p className="text-desc font-bold text-muted-foreground">
            مستند واحد على الأقل (سجل تجاري أو ترخيص أو تفويض رسمي). المستندات تُحفظ في حاوية خاصة
            وتُحذف تلقائيًا بعد {CLAIM_DOC_RETENTION_DAYS.toLocaleString("en-US")} يومًا من البتّ في
            الطلب.
          </p>

          <textarea
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
            rows={2}
            placeholder="توضيح إضافي (اختياري)"
            className="w-full resize-none rounded-xl border border-input bg-background p-2.5 text-desc outline-none focus:border-primary"
          />

          <button
            type="button"
            disabled={
              submit.isPending ||
              !verifiedPhone ||
              files.length === 0 ||
              applicantName.trim().length < 3
            }
            onClick={() =>
              submit.mutate(
                {
                  applicantName,
                  applicantRole,
                  phone: verifiedPhone ?? "",
                  phoneVerified: !!verifiedPhone,
                  evidence,
                  files: files.map((file) => ({ file, kind: docKind })),
                },
                {
                  onSuccess: () => {
                    setOpen(false);
                    setFiles([]);
                    toast.success("تم إرسال المطالبة للمراجعة اليدوية");
                  },
                  onError: (error: unknown) =>
                    toast.error(
                      String((error as Error).message).includes("DOC_TOO_LARGE")
                        ? "حجم المستند كبير — الحد ٨ ميجابايت."
                        : "تعذّر إرسال المطالبة.",
                    ),
                },
              )
            }
            className="inline-flex h-10 items-center rounded-2xl bg-primary px-4 text-desc font-black text-primary-foreground disabled:opacity-50"
          >
            {submit.isPending ? "جاري الإرسال…" : "إرسال المطالبة"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 inline-flex h-9 items-center rounded-2xl border border-border px-3.5 text-desc font-black"
        >
          تقديم مطالبة
        </button>
      )}
    </section>
  );
}

