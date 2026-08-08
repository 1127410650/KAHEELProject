import { createFileRoute } from "@tanstack/react-router";

import { AppointmentsApp } from "@/appointments/AppointmentsApp";

export const Route = createFileRoute("/appointments")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "كَحيل مواعيد — KAHEEL Appointments" },
      {
        name: "description",
        content:
          "تطبيق مستقل لحجز المواعيد وقائمة الانتظار المباشرة، مرتبط بحساب كَحيل الموحد وقابل للفصل مستقبلًا.",
      },
      { property: "og:title", content: "كَحيل مواعيد — KAHEEL Appointments" },
      {
        property: "og:description",
        content: "احجز موعدك أو تابع دورك مباشرة عبر كَحيل مواعيد.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppointmentsApp,
});
