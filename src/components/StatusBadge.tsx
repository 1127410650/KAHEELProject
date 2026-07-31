import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

const tones: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  under_review: "bg-info/10 text-info border-info/30",
  returned: "bg-warning/15 text-warning-foreground border-warning/40",
  approved: "bg-success/12 text-success border-success/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
  active: "bg-success/12 text-success border-success/30",
  on_hold: "bg-warning/15 text-warning-foreground border-warning/40",
  completed: "bg-primary/10 text-primary border-primary/25",
  awaiting_payment: "bg-warning/20 text-warning-foreground border-warning/50",
  inactive: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[status] ?? "bg-secondary text-secondary-foreground border-border",
      )}
    >
      {t(`status.${status}`)}
    </span>
  );
}
