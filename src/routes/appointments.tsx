import { createFileRoute } from "@tanstack/react-router";

import { AppointmentsApp } from "@/appointments/AppointmentsApp";

export const Route = createFileRoute("/appointments")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "كَحيل مواعيد ودليل — KAHEEL Appointments" },
      {
        name: "description",
        content:
          "ابحث عن المراكز والعيادات والصيدليات القريبة، واحجز موعدك أو تابع قائمة الانتظار عبر كَحيل مواعيد.",
      },
      { property: "og:title", content: "كَحيل مواعيد ودليل — KAHEEL Appointments" },
      {
        property: "og:description",
        content: "أماكن وخدمات قريبة، حجز مواعيد، وقائمة انتظار مباشرة ضمن تجربة كَحيل المستقلة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppointmentsApp,
});