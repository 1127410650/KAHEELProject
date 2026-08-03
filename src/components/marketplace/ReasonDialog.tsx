import { useState, type ReactNode } from "react";

import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Every sensitive administrative action passes through here: the reason is
 * mandatory (the database rejects an empty one too) and the confirmation is
 * explicit, so no destructive action happens on a single stray tap.
 */
export function ReasonDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  pending = false,
  onCancel,
  onConfirm,
  children,
}: {
  open: boolean;
  title: string;
  description?: string | undefined;
  confirmLabel: string;
  destructive?: boolean;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReason("");
          onCancel();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <label className="block text-xs font-medium text-foreground">
          {t("admin.reason")}
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            className="mt-1.5"
            placeholder={t("admin.reasonHint")}
          />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending || reason.trim().length < 3}
            onClick={() => onConfirm(reason.trim())}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
