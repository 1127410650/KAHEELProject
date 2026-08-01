import { Building2, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { useSwitchWorkspace, useWorkspaces } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Workspace (tenant) switcher. Hidden entirely when the user belongs to a single
 * workspace, so the current single-entity experience stays unchanged.
 */
export function WorkspaceSwitcher() {
  const { t, locale } = useI18n();
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const switchWorkspace = useSwitchWorkspace();

  const current = workspaces.find((w) => w.is_current) ?? workspaces[0];
  const label = (w: { name_ar: string; name_en: string | null }) =>
    locale === "en" ? w.name_en || w.name_ar : w.name_ar;

  if (isLoading || workspaces.length < 2) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 min-w-0 shrink gap-1.5 px-2 sm:px-3"
          aria-label={t("workspace.switch")}
        >
          {switchWorkspace.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Building2 className="size-4 shrink-0" aria-hidden />
          )}
          <span className="max-w-[92px] truncate text-xs font-medium sm:max-w-[160px]">
            {current ? label(current) : "—"}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t("workspace.title")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((w) => (
          <DropdownMenuItem
            key={w.tenant_id}
            disabled={switchWorkspace.isPending || w.is_current}
            onSelect={() => {
              if (w.is_current) return;
              switchWorkspace.mutate(w.tenant_id, {
                onSuccess: () => toast.success(t("workspace.switched")),
                onError: () => toast.error(t("workspace.switchFailed")),
              });
            }}
            className="gap-2"
          >
            <Check
              className={cn("size-4 shrink-0", w.is_current ? "opacity-100" : "opacity-0")}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-sm">{label(w)}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {t(`roles.${w.role}`)}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
