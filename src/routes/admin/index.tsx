import { createFileRoute, Link } from "@tanstack/react-router";
import { useI18n } from "@/i18n";
import { AdminShell } from "@/components/marketplace/AdminShell";

export const Route = createFileRoute("/admin/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "إدارة السوق — سوق تحقّق" },
      { name: "description", content: "لوحة إدارة السوق: مراجعة الإعلانات وطلبات توثيق المنشآت." },
      { property: "og:title", content: "إدارة السوق — سوق تحقّق" },
      { property: "og:description", content: "مراجعة الإعلانات وتوثيق المنشآت في سوق تحقّق." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminIndexPage,
});

function AdminIndexPage() {
  const { t } = useI18n();
  return (
    <AdminShell title={t("market.admin.title")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/admin/listings"
          className="rounded-xl border border-border bg-card p-5 text-sm font-semibold text-foreground hover:bg-accent"
        >
          {t("market.admin.listings")}
        </Link>
        <Link
          to="/admin/verifications"
          className="rounded-xl border border-border bg-card p-5 text-sm font-semibold text-foreground hover:bg-accent"
        >
          {t("market.admin.verifications")}
        </Link>
      </div>
    </AdminShell>
  );
}
