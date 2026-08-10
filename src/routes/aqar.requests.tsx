/** طلباتي في كَحيل عقار — إرسال الطلبات ومتابعتها يأتي في دفعة لاحقة. */

import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";

import { AqarShell } from "@/components/marketplace/aqar/AqarShell";

export const Route = createFileRoute("/aqar/requests")({
  head: () => ({
    meta: [
      { title: "طلباتي — كَحيل عقار" },
      { name: "description", content: "متابعة طلبات الحجز والمعاينة التي أرسلتها في كَحيل عقار." },
      { property: "og:title", content: "طلباتي — كَحيل عقار" },
      { property: "og:description", content: "طلبات الحجز والمعاينة الخاصة بك في كَحيل عقار." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AqarRequestsPage,
});

function AqarRequestsPage() {
  return (
    <AqarShell title="طلباتي" subtitle="الحجز والمعاينة" back="/aqar" backLabel="عقار">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 p-6 text-center">
        <ClipboardList className="size-8 text-primary" aria-hidden />
        <p className="text-body text-foreground">
          إرسال طلبات الحجز والمعاينة يُفتح قريبًا في دفعة الطلبات.
        </p>
        <Link to="/aqar" className="text-desc font-bold text-primary">
          تصفّح العقارات المتاحة
        </Link>
      </div>
    </AqarShell>
  );
}
