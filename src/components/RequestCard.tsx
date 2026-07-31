import { Link } from "@tanstack/react-router";
import { Clock, MessageSquare, Paperclip } from "lucide-react";

import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { StageBadge } from "@/components/RequestStage";
import { PaymentNoBadge } from "@/components/PaymentNoBadge";
import { formatDate, formatDateTime } from "@/lib/format";

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

/** One request as a readable card — no technical field names, no status dropdown. */
export function RequestCard({
  data,
  showRequester = false,
}: {
  data: RequestCardData;
  showRequester?: boolean;
}) {
  const { t } = useI18n();
  return (
    <article className="surface flex flex-col gap-2 p-2.5 sm:gap-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug sm:truncate sm:text-sm">
            {data.title}
          </h3>
          <p className="num mt-0.5 text-xs text-muted-foreground">{data.request_no}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.paymentNo && <PaymentNoBadge paymentNo={data.paymentNo} />}
          <StageBadge status={data.status} />
        </div>
      </div>


      {/* Mobile: one compact meta line. Desktop: full field grid. */}
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground sm:hidden">
        {data.projectName && <span className="max-w-[45%] truncate">{data.projectName}</span>}
        {data.amountText && <span className="num font-medium text-foreground">{data.amountText}</span>}
        <span className="num">{formatDateTime(data.updatedAt)}</span>
      </p>

      <dl className="hidden gap-1 text-[11px] text-muted-foreground sm:grid sm:grid-cols-2 sm:gap-1.5 sm:text-xs">
        <div className="flex gap-1.5">
          <dt>{t("requests.requestType")}:</dt>
          <dd className="truncate font-medium text-foreground">{data.typeLabel}</dd>
        </div>
        {data.projectName && (
          <div className="flex gap-1.5">
            <dt>{t("requests.project")}:</dt>
            <dd className="truncate font-medium text-foreground">{data.projectName}</dd>
          </div>
        )}
        {showRequester && data.requesterName && (
          <div className="flex gap-1.5">
            <dt>{t("requests.requester")}:</dt>
            <dd className="truncate font-medium text-foreground">{data.requesterName}</dd>
          </div>
        )}
        {data.amountText && (
          <div className="flex gap-1.5">
            <dt>{t("common.amount")}:</dt>
            <dd className="num font-medium text-foreground">{data.amountText}</dd>
          </div>
        )}
        <div className="flex gap-1.5">
          <dt>{t("requests.requestDate")}:</dt>
          <dd className="num font-medium text-foreground">{formatDate(data.requestDate)}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="size-3.5" aria-hidden />
          <dt className="sr-only">{t("requests.lastUpdate")}</dt>
          <dd className="num">{formatDateTime(data.updatedAt)}</dd>
        </div>
      </dl>

      <p className="rounded-lg bg-secondary/70 px-2 py-1 text-[11px] leading-snug text-foreground/90 sm:px-3 sm:py-2 sm:text-xs">
        <span className="font-semibold">{t("action.short")}: </span>
        {data.actionText}
      </p>

      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-3 text-xs text-muted-foreground">
          {!!data.unread && (
            <span className="inline-flex items-center gap-1 font-medium text-primary">
              <MessageSquare className="size-3.5" aria-hidden />
              <span className="num">{data.unread}</span>
            </span>
          )}
          <Paperclip className="size-3.5 opacity-0" aria-hidden />
        </span>
        <Button asChild size="sm" variant="outline" className="h-8 px-3 text-xs sm:h-9 sm:text-sm">
          <Link to="/requests/$id" params={{ id: data.id }}>
            {t("requests.viewRequest")}
          </Link>
        </Button>
      </div>

    </article>
  );
}
