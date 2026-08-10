/**
 * Admin review queue for guide-place contributions: customer photos, reviews
 * and ownership claims. Nothing a visitor submits is public until it is
 * approved here, and every rejection carries a reason back to its author.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ShieldQuestion, Star, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/marketplace/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import {
  guidePhotoUrl,
  useDecideGuideContribution,
  useGuideReviewQueue,
  type GuideContributionStatus,
  type GuideQueueTarget,
} from "@/lib/mkt-guide-community";

export const Route = createFileRoute("/admin/guide-queue")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "مراجعة مساهمات الدليل — لوحة مدير النظام" },
      {
        name: "description",
        content: "اعتماد أو رفض صور العملاء والتقييمات ومطالبات ملكية جهات دليل سوريا.",
      },
      { property: "og:title", content: "مراجعة مساهمات الدليل — لوحة مدير النظام" },
      { property: "og:description", content: "طابور مراجعة مساهمات الدليل." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminGuideQueuePage,
});

const STATUS_TABS: { value: GuideContributionStatus; label: string }[] = [
  { value: "pending", label: "قيد المراجعة" },
  { value: "approved", label: "معتمد" },
  { value: "rejected", label: "مرفوض" },
];

function AdminGuideQueuePage() {
  const [status, setStatus] = useState<GuideContributionStatus>("pending");
  const queue = useGuideReviewQueue(true, status);
  const decide = useDecideGuideContribution();

  const act = (target: GuideQueueTarget, id: string, approve: boolean) => {
    const reason = approve ? null : window.prompt("سبب الرفض (يُعرض لصاحب المساهمة):");
    if (!approve && !reason) return;
    decide.mutate(
      { target, id, approve, reason },
      {
        onSuccess: () => toast.success(approve ? "تم الاعتماد" : "تم الرفض"),
        onError: () => toast.error("تعذّر تنفيذ القرار."),
      },
    );
  };

  const data = queue.data;

  return (
    <AdminShell title="مراجعة مساهمات الدليل">
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-black">مراجعة مساهمات الدليل</h1>
          <p className="text-desc text-muted-foreground">
            الصور والتقييمات والمطالبات لا تُنشر إلا بعد الاعتماد من هنا.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((tab) => (
            <Button
              key={tab.value}
              size="sm"
              variant={status === tab.value ? "default" : "outline"}
              onClick={() => setStatus(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {queue.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : queue.error ? (
          <p className="text-sm font-bold text-destructive">تعذّر تحميل الطابور.</p>
        ) : !data ? null : (
          <div className="space-y-5">
            <QueueGroup title="صور العملاء" count={data.photos.length}>
              {data.photos.map((photo) => (
                <Card key={photo.id}>
                  <CardContent className="flex flex-wrap items-center gap-3 p-3">
                    <img
                      src={guidePhotoUrl(photo.storage_path)}
                      alt=""
                      loading="lazy"
                      width={80}
                      height={80}
                      className="size-20 shrink-0 rounded-xl object-cover"
                    />
                    <div className="min-w-0 flex-1 text-desc">
                      <PlaceLink name={photo.place_name} slug={photo.place_slug} />
                      <p className="text-muted-foreground">
                        {photo.caption || "بدون وصف"} · {formatDateTime(photo.created_at)}
                      </p>
                    </div>
                    <Decision
                      status={status}
                      onApprove={() => act("photo", photo.id, true)}
                      onReject={() => act("photo", photo.id, false)}
                    />
                  </CardContent>
                </Card>
              ))}
            </QueueGroup>

            <QueueGroup title="التقييمات والتعليقات" count={data.reviews.length}>
              {data.reviews.map((review) => (
                <Card key={review.id}>
                  <CardContent className="flex flex-wrap items-center gap-3 p-3">
                    <Badge variant="outline" className="shrink-0 gap-1">
                      <Star className="size-3 fill-gold text-gold" aria-hidden />
                      {review.rating}
                    </Badge>
                    <div className="min-w-0 flex-1 text-desc">
                      <PlaceLink name={review.place_name} slug={review.place_slug} />
                      <p className="whitespace-pre-line text-muted-foreground">
                        {review.comment || "بدون تعليق"}
                      </p>
                      <p className="text-desc text-muted-foreground">
                        {review.display_name ?? "زائر"} · {formatDateTime(review.created_at)}
                      </p>
                    </div>
                    <Decision
                      status={status}
                      onApprove={() => act("review", review.id, true)}
                      onReject={() => act("review", review.id, false)}
                    />
                  </CardContent>
                </Card>
              ))}
            </QueueGroup>

            <QueueGroup title="مطالبات الملكية" count={data.claims.length}>
              {data.claims.map((claim) => (
                <Card key={claim.id}>
                  <CardContent className="flex flex-wrap items-center gap-3 p-3">
                    <ShieldQuestion className="size-5 shrink-0 text-market-navy" aria-hidden />
                    <div className="min-w-0 flex-1 text-desc">
                      <PlaceLink name={claim.place_name} slug={claim.place_slug} />
                      <p className="whitespace-pre-line text-muted-foreground">{claim.evidence}</p>
                      <p className="text-desc text-muted-foreground">
                        {claim.contact ?? "بدون رقم"} · {formatDateTime(claim.created_at)}
                      </p>
                    </div>
                    <Decision
                      status={status}
                      onApprove={() => act("claim", claim.id, true)}
                      onReject={() => act("claim", claim.id, false)}
                    />
                  </CardContent>
                </Card>
              ))}
            </QueueGroup>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function QueueGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-black">
        {title} <span className="text-muted-foreground">({count.toLocaleString("en-US")})</span>
      </h2>
      {count === 0 ? (
        <p className="text-desc text-muted-foreground">لا عناصر.</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  );
}

function PlaceLink({ name, slug }: { name: string | null; slug: string | null }) {
  if (!slug) return <p className="font-black">{name ?? "جهة محذوفة"}</p>;
  return (
    <Link
      to="/guides/syria/$slug"
      params={{ slug }}
      target="_blank"
      className="font-black text-market-navy"
    >
      {name ?? slug}
    </Link>
  );
}

function Decision({
  status,
  onApprove,
  onReject,
}: {
  status: GuideContributionStatus;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex shrink-0 gap-1.5">
      {status !== "approved" ? (
        <Button size="sm" onClick={onApprove} className="gap-1">
          <CheckCircle2 className="size-3.5" aria-hidden />
          اعتماد
        </Button>
      ) : null}
      {status !== "rejected" ? (
        <Button size="sm" variant="outline" onClick={onReject} className="gap-1">
          <XCircle className="size-3.5" aria-hidden />
          رفض
        </Button>
      ) : null}
    </div>
  );
}
