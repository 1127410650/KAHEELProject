import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { SIMPLE_STAGES, simpleStage, stageIndex, stageTone } from "@/lib/request-ui";

/** Compact badge showing the simplified phase instead of the raw DB status. */
export function StageBadge({ status, className }: { status: string; className?: string }) {
  const { t } = useI18n();
  const stage = simpleStage(status);
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        stageTone(stage),
        className,
      )}
    >
      {t(`stage.${stage}`)}
    </span>
  );
}

/** Five-step progress rail. Highlights the current phase only — no percentages. */
export function StageBar({ status }: { status: string }) {
  const { t } = useI18n();
  const stage = simpleStage(status);
  const current = stageIndex(status);
  const terminal = current < 0;

  if (terminal) {
    return (
      <div
        className={cn(
          "rounded-xl border px-4 py-3 text-sm font-medium",
          stageTone(stage),
        )}
        role="status"
      >
        {t(`stage.${stage}`)}
      </div>
    );
  }

  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label={t("stage.railLabel")}>
      {SIMPLE_STAGES.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex items-center gap-2">
            <span
              aria-current={active ? "step" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active && "border-primary bg-primary text-primary-foreground shadow-sm",
                done && "border-success/40 bg-success/10 text-success",
                !active && !done && "border-border bg-card text-muted-foreground",
              )}
            >
              <span className="num text-[10px] opacity-70">{i + 1}</span>
              {t(`stage.${s}`)}
            </span>
            {i < SIMPLE_STAGES.length - 1 && (
              <span aria-hidden className="text-muted-foreground">
                <span className="ltr:hidden">←</span>
                <span className="hidden ltr:inline">→</span>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
