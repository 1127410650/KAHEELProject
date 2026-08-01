import { Link } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";

import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { StageBadge } from "@/components/RequestStage";
import { PaymentNoBadge } from "@/components/PaymentNoBadge";
import { formatDateTime } from "@/lib/format";

export interface RequestCardData {
  id: string;
  request_no: string;
  title: string;
  typeLabel: string;
  projectName?: string | null;
  requesterName?: string | null;
  status: string;
  requestDate: string | null;
  updatedAt: string | null;
  actionText: string;
  unread?: number;
  amountText?: string | null;
  paymentNo?: string | null;
}

/**
 * One request as a compact card: title + status badge, a secondary meta line,
 * one short "what is needed" strip and a single «view» action.
 */
export function RequestCard({
  data,
  showRequester = false,
}: {
  data: RequestCardData;
  showRequester?: boolean;
}) {
  const { t } = useI18n();
  return (
    <article className="surface flex flex-col gap-1.5 p-2.5 sm:gap-2 sm:p-3.5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 line-clamp-2 text-[14px] font-semibold leading-snug sm:text-sm">
          {data.title}
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {data.paymentNo && <PaymentNoBadge paymentNo={data.paymentNo} />}
          <StageBadge status={data.status} className="px-2 py-0 text-[11px]" />
        </div>
      </div>

      {/* Secondary meta line — no field labels, no full detail dump. */}
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-tight text-muted-foreground">
        <span className="num">{data.request_no}</span>
        {data.projectName && <span className="max-w-[45%] truncate">{data.projectName}</span>}
        {showRequester && data.requesterName && (
          <span className="max-w-[40%] truncate">{data.requesterName}</span>
        )}
        {data.amountText && <span className="num font-medium text-foreground">{data.amountText}</span>}
        <span className="num">{formatDateTime(data.updatedAt)}</span>
      </p>

      <p className="line-clamp-2 rounded-lg bg-secondary/70 px-2 py-1 text-[11px] leading-snug text-foreground/90 sm:text-xs">
        <span className="font-semibold">{t("action.short")}: </span>
        {data.actionText}
      </p>

      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {!!data.unread && (
            <span className="inline-flex items-center gap-1 font-medium text-primary">
              <MessageSquare className="size-3.5" aria-hidden />
              <span className="num">{data.unread}</span>
            </span>
          )}
        </span>
        <Button asChild size="sm" variant="outline" className="h-7 px-3 text-xs sm:h-8">
          <Link to="/requests/$id" params={{ id: data.id }}>
            {t("requests.viewRequest")}
          </Link>
        </Button>
      </div>
    </article>
  );
}
