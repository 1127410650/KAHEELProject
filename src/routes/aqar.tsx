import { Outlet, createFileRoute } from "@tanstack/react-router";

/** مسار تخطيطي لقسم «كَحيل عقار» — كل الصفحات الفرعية تُركّب داخله. */
export const Route = createFileRoute("/aqar")({
  component: () => <Outlet />,
});
