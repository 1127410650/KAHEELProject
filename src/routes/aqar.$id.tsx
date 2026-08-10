/**
 * صفحة الإعلان العقاري: معرض صور، تفاصيل (مساحة، غرف، حمّامات، طابق، فرش)،
 * موقع على خريطة OpenStreetMap، ثم شريط سفلي ثابت لطلب الحجز أو التواصل.
 * قراءة فقط — الطلب نفسه في الدفعات التالية.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import {
  BedDouble,
  Bath,
  Building2,
  CalendarDays,
  Heart,
  ImageOff,
  Layers,
  MapPin,
  Ruler,
  Sofa,
} from "lucide-react";
import { lazy, useState } from "react";

import { AqarShell } from "@/components/marketplace/aqar/AqarShell";
import { useAqarFavorites } from "@/lib/aqar-favorites";
import { AQAR_TYPE_LABELS } from "@/lib/aqar-imagery";
import {
  fetchAqarListing,
  fetchAqarProvider,
  fetchAqarRoomTypes,
  fetchAqarUsdRate,
  formatAqarAmount,
  formatAqarPrice,
} from "@/lib/mkt-aqar";

const AqarMapView = lazy(() => import("@/components/marketplace/aqar/AqarMapView"));

export const Route = createFileRoute("/aqar/$id")({
  head: () => ({
    meta: [
      { title: "تفاصيل العقار — كَحيل عقار" },
      {
        name: "description",
        content: "صور العقار وتفاصيله وموقعه على الخريطة وطريقة إرسال طلب الحجز أو الشراء.",
      },
      { property: "og:title", content: "تفاصيل العقار — كَحيل عقار" },
      {
        property: "og:description",
        content: "صور وتفاصيل العقار وموقعه على الخريطة على كَحيل عقار.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AqarListingPage,
});

function Spec({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Ruler;
  label: string;
  value: string;
}) {
  return (
    <li className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
      <Icon className="size-5 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0">
        <span className="block text-nav text-muted-foreground">{label}</span>
        <strong className="block truncate text-desc font-bold text-foreground">{value}</strong>
      </span>
    </li>
  );
}

function AqarListingPage() {
  const { id } = Route.useParams();
  const { ids, toggle } = useAqarFavorites();
  const [index, setIndex] = useState(0);

  const listing = useQuery({ queryKey: ["aqar", "listing", id], queryFn: () => fetchAqarListing(id) });
  const usdRate = useQuery({
    queryKey: ["aqar", "usd-rate"],
    queryFn: fetchAqarUsdRate,
    staleTime: 5 * 60 * 1000,
  });
  const providerId = listing.data?.provider_id;
  const provider = useQuery({
    queryKey: ["aqar", "provider", providerId],
    queryFn: () => fetchAqarProvider(providerId as string),
    enabled: Boolean(providerId),
  });
  const rooms = useQuery({
    queryKey: ["aqar", "room-types", id],
    queryFn: () => fetchAqarRoomTypes(id),
    enabled: listing.data?.deal_track === "daily_rent",
  });

  if (listing.isPending) {
    return (
      <AqarShell title="تفاصيل العقار" back="/aqar" backLabel="عقار">
        <p className="p-4 text-body text-muted-foreground">جارٍ التحميل…</p>
      </AqarShell>
    );
  }

  const row = listing.data;
  if (!row) {
    return (
      <AqarShell title="تفاصيل العقار" back="/aqar" backLabel="عقار">
        <div className="mx-auto max-w-3xl p-4">
          <p className="text-body text-foreground">هذا الإعلان غير متاح أو تم إيقاف نشره.</p>
          <Link to="/aqar" className="mt-3 inline-block text-desc font-bold text-primary">
            رجوع إلى كَحيل عقار
          </Link>
        </div>
      </AqarShell>
    );
  }

  const price = formatAqarPrice(row, usdRate.data ?? null);
  const favorite = ids.includes(row.id);
  const photo = row.photos[Math.min(index, Math.max(row.photos.length - 1, 0))];
  const hasPoint = typeof row.latitude === "number" && typeof row.longitude === "number";

  return (
    <AqarShell
      title={AQAR_TYPE_LABELS[row.property_type] ?? "عقار"}
      subtitle={`${row.city}${row.district ? ` — ${row.district}` : ""}`}
      back="/aqar"
      backLabel="عقار"
    >
      <div className="mx-auto w-full max-w-3xl pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        {/* المعرض: ارتفاع ثابت + شرائح مصغّرة، فلا إزاحة تخطيط عند تبديل الصور. */}
        <div className="relative aspect-4/3 w-full bg-muted">
          {photo ? (
            <img src={photo} alt={row.title} className="size-full object-cover" decoding="async" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImageOff className="size-7" aria-hidden />
            </div>
          )}
          <button
            type="button"
            aria-label={favorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
            aria-pressed={favorite}
            onClick={() => toggle(row.id)}
            className="absolute end-3 top-3 inline-flex size-11 items-center justify-center rounded-full bg-card/90 shadow-sm"
          >
            <Heart className={`size-5 ${favorite ? "fill-primary text-primary" : ""}`} aria-hidden />
          </button>
        </div>

        {row.photos.length > 1 ? (
          <ul className="flex gap-2 overflow-x-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {row.photos.map((url, i) => (
              <li key={url} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`الصورة ${i + 1}`}
                  aria-current={i === index}
                  className={`block size-16 overflow-hidden rounded-xl border-2 ${
                    i === index ? "border-primary" : "border-border"
                  }`}
                >
                  <img src={url} alt="" loading="lazy" className="size-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <section className="px-4 pt-2">
          <h1 className="text-page font-extrabold text-foreground">{row.title}</h1>
          <p className="mt-1 flex items-center gap-1 text-desc text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden />
            {row.address_text || `${row.city} — ${row.district}`}
          </p>
          {row.is_demo ? (
            <p className="mt-2 rounded-xl bg-secondary px-3 py-2 text-desc font-bold text-secondary-foreground">
              إعلان تجريبي لعرض شكل المنصة — لا تُقبل عليه أي طلبات حقيقية.
            </p>
          ) : null}
        </section>

        <section className="px-4 pt-3">
          <h2 className="mb-2 text-section font-extrabold text-foreground">تفاصيل العقار</h2>
          <ul className="grid grid-cols-2 gap-2">
            {row.area_sqm ? (
              <Spec
                icon={Ruler}
                label="المساحة"
                value={`${Number(row.area_sqm).toLocaleString("en-US")} م²`}
              />
            ) : null}
            {row.rooms ? <Spec icon={BedDouble} label="الغرف" value={String(row.rooms)} /> : null}
            {row.bathrooms ? (
              <Spec icon={Bath} label="الحمّامات" value={String(row.bathrooms)} />
            ) : null}
            {typeof row.floor_no === "number" ? (
              <Spec icon={Layers} label="الطابق" value={String(row.floor_no)} />
            ) : null}
            {row.build_year ? (
              <Spec icon={CalendarDays} label="سنة البناء" value={String(row.build_year)} />
            ) : null}
            <Spec icon={Sofa} label="الفرش" value={row.is_furnished ? "مفروش" : "غير مفروش"} />
            <Spec
              icon={Building2}
              label="النوع"
              value={AQAR_TYPE_LABELS[row.property_type] ?? "عقار"}
            />
          </ul>
        </section>

        {row.amenities && row.amenities.length > 0 ? (
          <section className="px-4 pt-4">
            <h2 className="mb-2 text-section font-extrabold text-foreground">المزايا</h2>
            <ul className="flex flex-wrap gap-2">
              {row.amenities.map((item) => (
                <li key={item} className="k-pill text-desc font-semibold">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {row.description ? (
          <section className="px-4 pt-4">
            <h2 className="mb-2 text-section font-extrabold text-foreground">الوصف</h2>
            <p className="whitespace-pre-line text-body text-foreground">{row.description}</p>
          </section>
        ) : null}

        {(rooms.data ?? []).length > 0 ? (
          <section className="px-4 pt-4">
            <h2 className="mb-2 text-section font-extrabold text-foreground">أنواع الغرف</h2>
            <ul className="flex flex-col gap-2">
              {(rooms.data ?? []).map((roomType) => (
                <li
                  key={roomType.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2"
                >
                  <span className="min-w-0">
                    <strong className="block truncate text-title font-bold text-foreground">
                      {roomType.name}
                    </strong>
                    <span className="text-desc text-muted-foreground">
                      {roomType.availability === "available" ? "متاح" : "مكتمل"}
                    </span>
                  </span>
                  <strong className="shrink-0 text-price font-extrabold text-primary">
                    {formatAqarAmount(roomType.price, roomType.price_currency)}
                  </strong>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {hasPoint ? (
          <section className="px-4 pt-4">
            <h2 className="mb-2 text-section font-extrabold text-foreground">الموقع</h2>
            <ClientOnly fallback={<div className="h-56 rounded-2xl border border-border bg-muted" />}>
              <AqarMapView
                lat={row.latitude as number}
                lng={row.longitude as number}
                approximate={row.deal_track !== "sale"}
              />
            </ClientOnly>
            <p className="pt-1 text-nav text-muted-foreground">
              خرائط © المساهمون في OpenStreetMap
              {row.deal_track !== "sale" ? " — الموقع تقريبي لحماية خصوصية العقار." : ""}
            </p>
          </section>
        ) : null}

        {provider.data ? (
          <section className="px-4 pt-4">
            <h2 className="mb-2 text-section font-extrabold text-foreground">المزوّد</h2>
            <p className="rounded-xl border border-border bg-card px-3 py-2 text-body text-foreground">
              {provider.data.display_name}
              {provider.data.verification_status === "verified" ? (
                <span className="ms-1 text-desc font-bold text-primary">✔ موثّق</span>
              ) : null}
            </p>
          </section>
        ) : null}
      </div>

      {/* شريط سفلي ثابت فوق شريط تنقل القسم: السعر + زر الطلب. */}
      <div
        className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-card/95 px-4 py-2 backdrop-blur"
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-price font-extrabold text-primary">
              {price.main}
              {price.period ? (
                <span className="text-desc font-semibold text-muted-foreground"> {price.period}</span>
              ) : null}
            </strong>
            {price.secondary ? (
              <span className="block truncate text-nav text-muted-foreground">
                ≈ {price.secondary}
              </span>
            ) : null}
          </span>
          <Link
            to="/aqar/requests"
            className="inline-flex shrink-0 items-center rounded-full bg-primary px-5 text-body font-bold text-primary-foreground"
            style={{ minHeight: 44 }}
          >
            {row.deal_track === "sale" ? "طلب معاينة" : "طلب حجز"}
          </Link>
        </div>
      </div>
    </AqarShell>
  );
}
