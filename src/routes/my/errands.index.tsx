/**
 * «طلبات جيب لي» — قائمة طلبات المستخدم مع حالتها الحالية.
 *
 * القراءة كلها محصورة بـ RLS على `user_id = auth.uid()`، فلا يظهر هنا أي طلب
 * لغير صاحبه. التفاصيل والعروض في صفحة الطلب المفردة.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { PackageSearch, Plus } from "lucide-react";

import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { formatDateTime, formatMoney } from "@/lib/format";
import { errandStatusLabel, useMyErrands } from "@/lib/mkt-errands";

export const Route = createFileRoute("/my/errands/")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "طلبات جيب لي — كَحيل" },
      {
        name: "description",
        content: "طلبات «جيب لي» الخاصة بك: حالة كل طلب، عروض الكباتن، والتتبّع حتى التسليم.",
      },
      { property: "og:title", content: "طلبات جيب لي — كَحيل" },
      { property: "og:description", content: "تابع طلباتك من الإرسال حتى التسليم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyErrandsPage,
});

function MyErrandsPage() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { session } = useSession();
  const errands = useMyErrands(session?.user.id ?? null);

  return (
    <DashboardShell title={ar ? "طلبات جيب لي" : "My errands"}>
      <div className="mx-auto w-full max-w-2xl px-3 pb-24 pt-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h1 className="text-base font-black text-foreground">
            {ar ? "طلبات جيب لي" : "My errands"}
          </h1>
          <Button asChild size="sm" className="h-9 gap-1 text-desc font-bold">
            <Link to="/errands">
              <Plus className="h-4 w-4" />
              {ar ? "طلب جديد" : "New request"}
            </Link>
          </Button>
        </div>

        {!session ? (
          <p className="rounded-2xl border border-border/70 bg-card/60 p-4 text-center text-desc text-muted-foreground">
            {ar ? "سجّل دخولك لعرض طلباتك." : "Sign in to see your requests."}
          </p>
        ) : errands.isLoading ? (
          <div className="grid gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-[92px] rounded-2xl" />
            ))}
          </div>
        ) : (errands.data?.length ?? 0) === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-6 text-center">
            <PackageSearch className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
            <p className="text-desc text-muted-foreground">
              {ar ? "ما عندك طلبات بعد — جرّب «جيب لي»." : "No requests yet — try “Get it for me”."}
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {errands.data!.map((errand) => (
              <Link
                key={errand.id}
                to="/my/errands/$id"
                params={{ id: errand.id }}
                className="block rounded-2xl border border-border/70 bg-card/60 p-3 transition hover:border-primary/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 min-w-0 text-desc font-semibold leading-snug text-foreground">
                    {errand.details}
                  </p>
                  <Badge variant="secondary" className="shrink-0 text-desc">
                    {errandStatusLabel(errand.status, ar)}
                  </Badge>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-desc text-muted-foreground">
                  <span>{formatDateTime(errand.created_at)}</span>
                  <span>
                    {ar ? "العروض" : "Offers"}: {errand.offers_count}
                  </span>
                  {errand.delivery_fee != null ? (
                    <span className="font-bold text-primary">
                      {ar ? "التوصيل" : "Delivery"} {formatMoney(errand.delivery_fee, locale)}
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
