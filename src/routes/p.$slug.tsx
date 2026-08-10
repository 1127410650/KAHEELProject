/**
 * بروفايل المعلن العقاري العام — /p/{المعرّف}
 *
 * صفحة عامة تُقرأ عبر دالة محدودة الحقول: الاسم، شارة التوثيق، النوع،
 * إحصاءات صادقة (الإعلانات النشطة، متوسط سرعة الرد فعلًا من الطلبات
 * المحسومة)، ثم شبكة إعلاناته المنشورة. لا جوال ولا بريد إلا إن فعّلهما
 * المعلن بنفسه. أزرار: محادثة، مشاركة، إبلاغ، ورمز QR للطباعة.
 */

import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  Flag,
  Mail,
  MapPin,
  MessagesSquare,
  Phone,
  Printer,
  QrCode,
  Share2,
  Star,

  Timer,
} from "lucide-react";

import { AqarShell } from "@/components/marketplace/aqar/AqarShell";
import { AqarListingCard } from "@/components/marketplace/aqar/AqarListingCard";
import { ShareSheet } from "@/components/marketplace/ShareSheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { canonicalUrl } from "@/lib/share-links";
import { useAqarFavorites } from "@/lib/aqar-favorites";
import { fetchAqarListingsByProvider, fetchAqarUsdRate } from "@/lib/mkt-aqar";
import {
  AQAR_PROVIDER_TYPE_LABELS,
  fetchAqarPublicProvider,
  formatResponseSpeed,
} from "@/lib/mkt-aqar-profile";
import {
  AQAR_REVIEW_TAG_LABELS,
  fetchAqarProviderReviewStats,
  formatRating,
} from "@/lib/mkt-aqar-reviews";

import { buildQrCardPng, downloadDataUrl, qrDataUrl } from "@/lib/kaheel-qr-card";
import { useLabels } from "@/lib/mkt-ui-labels";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/p/$slug")({
  ssr: "data-only",
  head: ({ params }) => {
    const title = "بروفايل معلن — كَحيل عقار";
    const description =
      "الملف العام للمعلن على كَحيل عقار: النوع، حالة التوثيق، إحصاءاته، وإعلاناته المنشورة.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: canonicalUrl(`/p/${params.slug}`) }],
    };
  },
  component: AdvertiserProfilePage,
});

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Timer;
  label: string;
  value: string;
}) {
  return (
    <li className="rounded-[var(--r-card)] border border-border bg-card px-3 py-3">
      <span className="flex items-center gap-1 text-nav text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden />
        {label}
      </span>
      <strong className="mt-1 block truncate text-title font-extrabold text-foreground">
        {value}
      </strong>
    </li>
  );
}

function AdvertiserProfilePage() {
  const { slug } = Route.useParams();
  const label = useLabels();
  const { ids, toggle } = useAqarFavorites();
  const [qrOpen, setQrOpen] = useState(false);
  const [qrPng, setQrPng] = useState<string | null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const provider = useQuery({
    queryKey: ["aqar", "public-provider", slug],
    queryFn: () => fetchAqarPublicProvider(slug),
  });
  const providerId = provider.data?.id;
  const listings = useQuery({
    queryKey: ["aqar", "provider-listings", providerId],
    queryFn: () => fetchAqarListingsByProvider(providerId as string, 24),
    enabled: Boolean(providerId),
  });
  const reviewStats = useQuery({
    queryKey: ["aqar", "provider-review-stats", providerId],
    queryFn: () => fetchAqarProviderReviewStats(providerId as string),
    enabled: Boolean(providerId),
    staleTime: 5 * 60 * 1000,
  });

  const usdRate = useQuery({
    queryKey: ["aqar", "usd-rate"],
    queryFn: fetchAqarUsdRate,
    staleTime: 5 * 60 * 1000,
  });

  const profileUrl = canonicalUrl(`/p/${slug}`);

  // الرمز يُولَّد في المتصفح عند فتح اللوحة فقط.
  useEffect(() => {
    if (!qrOpen || qrPng) return;
    let alive = true;
    void qrDataUrl(profileUrl, 720).then((url) => {
      if (alive) setQrPng(url);
    });
    return () => {
      alive = false;
    };
  }, [qrOpen, qrPng, profileUrl]);

  if (provider.isPending) {
    return (
      <AqarShell title="بروفايل المعلن" back="/aqar" backLabel={label("aqar.back", "عقار")}>
        <div className="mx-auto max-w-3xl space-y-3 p-4">
          <Skeleton className="h-24 w-full rounded-[var(--r-card)]" />
          <Skeleton className="h-20 w-full rounded-[var(--r-card)]" />
        </div>
      </AqarShell>
    );
  }

  const row = provider.data;
  if (!row) {
    return (
      <AqarShell title="بروفايل المعلن" back="/aqar" backLabel={label("aqar.back", "عقار")}>
        <div className="mx-auto max-w-3xl p-4">
          <p className="text-body text-foreground">هذا البروفايل غير متاح.</p>
          <Link to="/aqar" className="mt-3 inline-block text-desc font-bold text-primary">
            {label("aqar.back_to_aqar", "رجوع إلى كَحيل عقار")}
          </Link>
        </div>
      </AqarShell>
    );
  }

  const typeLabel = AQAR_PROVIDER_TYPE_LABELS[row.provider_type] ?? typeFallback(row.provider_type);

  async function downloadCard() {
    setCardBusy(true);
    try {
      const png = await buildQrCardPng({
        advertiserName: row!.display_name,
        advertiserType: typeLabel,
        city: row!.city,
        url: profileUrl,
      });
      downloadDataUrl(png, `kaheel-qr-${row!.slug}-A5.png`);
    } finally {
      setCardBusy(false);
    }
  }

  return (
    <AqarShell
      title={row.display_name}
      subtitle={[typeLabel, row.city ?? ""].filter(Boolean).join(" — ")}
      back="/aqar"
      backLabel={label("aqar.back", "عقار")}
    >
      <div className="mx-auto w-full max-w-3xl pb-8">
        <section className="px-4 pt-4">
          <div className="rounded-[var(--r-card)] border border-border bg-card p-4">
            <h1 className="flex flex-wrap items-center gap-2 text-page font-extrabold text-foreground">
              {row.display_name}
              {row.verification_status === "verified" ? (
                <span className="k-pill px-3 py-0.5 text-desc font-bold">
                  ✔ {label("aqar.verified", "موثّق")}
                </span>
              ) : null}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-desc text-muted-foreground">
              <span className="k-pill px-3 py-0.5 font-semibold">{typeLabel}</span>
              {row.city ? (
                <span className="flex items-center gap-1">
                  <MapPin className="size-4 shrink-0" aria-hidden />
                  {row.city}
                </span>
              ) : null}
              <span>عضو منذ {formatDate(row.created_at)}</span>
            </p>
            {row.bio ? (
              <p className="mt-2 whitespace-pre-line text-body text-foreground">{row.bio}</p>
            ) : null}
            {row.is_demo ? (
              <p className="mt-2 rounded-xl bg-secondary px-3 py-2 text-desc font-bold text-secondary-foreground">
                حساب تجريبي لعرض شكل المنصة.
              </p>
            ) : null}

            {/* التواصل المباشر لا يظهر إلا إن فعّله المعلن من إعداداته. */}
            {row.phone || row.public_email ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {row.phone ? (
                  <li>
                    <a
                      href={`tel:${row.phone}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-3 text-desc font-bold text-foreground"
                      style={{ minHeight: 44 }}
                    >
                      <Phone className="size-4" aria-hidden />
                      {row.phone}
                    </a>
                  </li>
                ) : null}
                {row.public_email ? (
                  <li>
                    <a
                      href={`mailto:${row.public_email}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-3 text-desc font-bold text-foreground"
                      style={{ minHeight: 44 }}
                    >
                      <Mail className="size-4" aria-hidden />
                      {row.public_email}
                    </a>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        </section>

        <section className="px-4 pt-4">
          <h2 className="mb-2 text-section font-extrabold text-foreground">
            {label("aqar.profile_stats", "إحصاءات")}
          </h2>
          <ul className="grid grid-cols-2 gap-2">
            <Stat
              icon={MapPin}
              label={label("aqar.profile_active", "إعلانات نشطة")}
              value={row.active_listings.toLocaleString("en-US")}
            />
            <Stat
              icon={Timer}
              label={label("aqar.profile_response", "متوسط سرعة الرد")}
              value={formatResponseSpeed(row.avg_response_minutes)}
            />
            {reviewStats.data && reviewStats.data.reviews_count > 0 ? (
              <Stat
                icon={Star}
                label="تقييم النزلاء"
                value={`${formatRating(reviewStats.data.rating_avg)} / 5 (${reviewStats.data.reviews_count.toLocaleString("en-US")})`}
              />
            ) : row.rating !== null ? (
              <Stat icon={Timer} label="التقييم" value={Number(row.rating).toFixed(1)} />
            ) : null}
          </ul>

          {/* شرائح أكثر ما أشاد به النزلاء — محسوبة في القاعدة لا على الجهاز. */}
          {reviewStats.data && (reviewStats.data.top_tags?.length ?? 0) > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {reviewStats.data.top_tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-primary/25 bg-secondary px-3 py-1 text-nav font-bold text-secondary-foreground"
                >
                  {AQAR_REVIEW_TAG_LABELS[tag] ?? tag}
                </li>
              ))}
            </ul>
          ) : null}
        </section>


        <section className="px-4 pt-4">
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/my/messages"
              className="inline-flex items-center justify-center gap-1 rounded-full bg-primary px-4 text-body font-bold text-primary-foreground"
              style={{ minHeight: 44 }}
            >
              <MessagesSquare className="size-5" aria-hidden />
              محادثة
            </Link>
            <ShareSheet title={`${row.display_name} — كَحيل عقار`} url={profileUrl}>
              <Button variant="outline" className="w-full gap-1" style={{ minHeight: 44 }}>
                <Share2 className="size-5" aria-hidden />
                مشاركة البروفايل
              </Button>
            </ShareSheet>
            <Button
              variant="outline"
              className="gap-1"
              style={{ minHeight: 44 }}
              onClick={() => setQrOpen(true)}
            >
              <QrCode className="size-5" aria-hidden />
              رمز QR
            </Button>
            <Button
              variant="outline"
              className="gap-1"
              style={{ minHeight: 44 }}
              onClick={() => setReportOpen((v) => !v)}
            >
              <Flag className="size-5" aria-hidden />
              إبلاغ
            </Button>
          </div>
          {reportOpen ? (
            <p className="mt-2 rounded-xl border border-border bg-card px-3 py-2 text-desc text-foreground">
              للإبلاغ عن هذا المعلن، افتح أي إعلان من إعلاناته واستخدم زر «إبلاغ» داخله ليصل
              البلاغ مرتبطًا بالإعلان المعني.
            </p>
          ) : null}
        </section>

        <section className="px-4 pt-5">
          <h2 className="mb-2 text-section font-extrabold text-foreground">
            {label("aqar.profile_listings", "إعلانات المعلن")}
          </h2>
          {listings.isPending ? (
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-52 rounded-[var(--r-card)]" />
              <Skeleton className="h-52 rounded-[var(--r-card)]" />
            </div>
          ) : (listings.data ?? []).length === 0 ? (
            <p className="text-body text-muted-foreground">لا توجد إعلانات منشورة حاليًا.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3">
              {(listings.data ?? []).map((listing) => (
                <li key={listing.id} className="min-w-0">
                  <AqarListingCard
                    listing={listing}
                    usdRate={usdRate.data ?? null}
                    isFavorite={ids.includes(listing.id)}
                    onToggleFavorite={toggle}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Sheet open={qrOpen} onOpenChange={setQrOpen}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>رمز QR للبروفايل</SheetTitle>
            <SheetDescription>
              يشير الرمز إلى رابط بروفايل «{row.display_name}» على كَحيل.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col items-center gap-3 p-4">
            {qrPng ? (
              <img
                src={qrPng}
                alt="رمز QR لبروفايل المعلن"
                className="size-56 rounded-[var(--r-card)] border border-border bg-card p-2"
              />
            ) : (
              <Skeleton className="size-56 rounded-[var(--r-card)]" />
            )}
            <p className="text-nav text-muted-foreground" dir="ltr">
              {profileUrl.replace(/^https?:\/\//, "")}
            </p>
            <div className="grid w-full max-w-sm grid-cols-1 gap-2">
              <Button
                className="gap-1"
                style={{ minHeight: 44 }}
                disabled={!qrPng}
                onClick={() => qrPng && downloadDataUrl(qrPng, `kaheel-qr-${row.slug}.png`)}
              >
                <Download className="size-5" aria-hidden />
                تنزيل صورة PNG
              </Button>
              <Button
                variant="outline"
                className="gap-1"
                style={{ minHeight: 44 }}
                disabled={cardBusy}
                onClick={() => void downloadCard()}
              >
                <Printer className="size-5" aria-hidden />
                {cardBusy ? "جارٍ التحضير…" : "بطاقة A5 للطباعة"}
              </Button>
            </div>
            <p className="text-nav text-muted-foreground">
              البطاقة بمقاس A5 (148×210 مم) بهوية كَحيل وعبارة «امسح للحجز والتقييم».
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </AqarShell>
  );
}

function typeFallback(value: string): string {
  return value === "agency" ? "مكتب عقاري" : value === "hotel" ? "فندق" : "فرد";
}
