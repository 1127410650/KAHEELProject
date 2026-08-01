import { Link } from "@tanstack/react-router";

import { StageBadge } from "@/components/RequestStage";
import { formatDate } from "@/lib/format";

/** Compact request row: title, request no, stage badge and date. Nothing else. */
export function RequestRow({
  id,
  title,
  requestNo,
  status,
  date,
}: {
  id: string;
  title: string;
  requestNo: string;
  status: string;
  date: string | null;
}) {
  return (
    <Link
      to="/requests/$id"
      params={{ id }}
      className="flex min-h-[56px] items-center justify-between gap-2 px-2.5 py-2 transition hover:bg-secondary/40 sm:px-4"
    >
      <span className="min-w-0">
        <span className="line-clamp-2 text-[13px] font-medium leading-snug sm:text-sm">{title}</span>
        <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="num">{requestNo}</span>
          <span className="num">{formatDate(date)}</span>
        </span>
      </span>
      <StageBadge status={status} className="shrink-0 px-2 py-0 text-[11px]" />
    </Link>
  );
}
