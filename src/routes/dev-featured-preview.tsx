import { createFileRoute } from "@tanstack/react-router";

import { ListingCard, type ListingCardData } from "@/components/marketplace/ListingCard";

export const Route = createFileRoute("/dev-featured-preview")({
  component: Preview,
  head: () => ({
    meta: [
      { title: "معاينة البطاقة المميزة — كَحيل" },
      { name: "description", content: "معاينة داخلية لشكل بطاقة الإعلان المميز مقابل العادي." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const base = {
  id: "1",
  slug: "demo-1",
  title: "شقة مفروشة للإيجار في دمشق — إطلالة مميزة",
  price: 4500,
  currency: "SAR",
  city: "دمشق",
  categoryLabel: "عقارات",
  published_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
} as unknown as ListingCardData;

function Preview() {
  const featured = { ...base, id: "2", slug: "demo-2", is_featured: true } as ListingCardData;
  return (
    <main className="mx-auto grid max-w-3xl grid-cols-2 gap-4 p-6">
      <ListingCard listing={featured} />
      <ListingCard listing={base} />
    </main>
  );
}
