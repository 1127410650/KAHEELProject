import {
  AlertOctagon,
  AlertTriangle,
  Archive,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Loader2,
  type LucideIcon,
} from "lucide-react";

import { useI18n } from "@/i18n";

/**
 * Single source of truth for status colour inside the admin console.
 *
 * A tone is never the only signal: every badge renders an icon and the status
 * text as well, so colour blindness or a monochrome screen loses nothing. These
 * tokens live under `--admin-*` and are used by the console only — the public
 * marketplace keeps its own palette untouched.
 */
export type AdminTone =
  | "critical"
  | "urgent"
  | "pending"
  | "progress"
  | "done"
  | "idle"
  | "verify";

const TONE_CLASS: Record<AdminTone, string> = {
  critical: "bg-admin-critical-soft text-admin-critical border-admin-critical/30",
  urgent: "bg-admin-urgent-soft text-admin-urgent border-admin-urgent/30",
  pending: "bg-admin-pending-soft text-admin-pending border-admin-pending/30",
  progress: "bg-admin-progress-soft text-admin-progress border-admin-progress/30",
  done: "bg-admin-done-soft text-admin-done border-admin-done/30",
  idle: "bg-admin-idle-soft text-admin-idle border-admin-idle/30",
  verify: "bg-admin-verify-soft text-admin-verify border-admin-verify/30",
};

const TONE_ICON: Record<AdminTone, LucideIcon> = {
  critical: AlertOctagon,
  urgent: AlertTriangle,
  pending: Clock,
  progress: Loader2,
  done: CheckCircle2,
  idle: Archive,
  verify: BadgeCheck,
};

/** Maps every status string the console can render onto one tone. */
export function toneForStatus(status: string | null | undefined): AdminTone {
  switch ((status ?? "").toLowerCase()) {
    case "permanent_ban":
    case "banned":
    case "critical":
    case "valid":
    case "confirmed":
      return "critical";
    case "urgent":
    case "high":
    case "suspend_account":
    case "suspended":
    case "expiring":
      return "urgent";
    case "pending":
    case "pending_review":
    case "in_review":
    case "under_review":
    case "needs_more":
    case "needs_info":
    case "needs_changes":
    case "new":
      return "pending";
    case "open":
    case "assigned":
    case "processing":
    case "medium":
      return "progress";
    case "published":
    case "approved":
    case "verified":
    case "resolved":
    case "closed":
    case "low":
      return "done";
    case "draft":
    case "archived":
    case "expired":
    case "inactive":
    case "invalid":
    case "deleted":
      return "idle";
    case "verification":
    case "verify":
      return "verify";
    default:
      return "idle";
  }
}

export function AdminStatusBadge({
  status,
  tone,
  label,
  priority,
}: {
  status?: string | null;
  tone?: AdminTone;
  /** Explicit text wins; otherwise the i18n key `admin.state.<status>` is used. */
  label?: string;
  priority?: string | null;
}) {
  const { t } = useI18n();
  const resolved = tone ?? toneForStatus(status);
  const Icon = TONE_ICON[resolved];
  const text = label ?? (status ? t(`admin.state.${status}`) : t("common.unknown"));
  return (
    <span
      className={
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-desc font-semibold " +
        TONE_CLASS[resolved]
      }
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{text}</span>
      {priority ? <span className="shrink-0 opacity-70">· {t(`admin.state.${priority}`)}</span> : null}
    </span>
  );
}
