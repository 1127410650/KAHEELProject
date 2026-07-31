import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PrintPortal } from "@/components/PrintPortal";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { Printer } from "lucide-react";

export interface VoucherData {
  serial: number;
  type: string;
  amount: number;
  date: string;
  status: string;
  supervisorName: string;
  nationalId: string;
  phone: string;
  projectName: string;
  reason: string | null;
  notes: string | null;
  reversalOfSerial?: number | null;
  reversedBySerial?: number | null;
}

function VoucherSheet({ data }: { data: VoucherData }) {
  const { t, locale, dir } = useI18n();

  return (
    <div dir={dir} lang={locale} className="voucher-sheet space-y-6 bg-card p-6">
      <header className="flex items-start justify-between border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">{t("app.name")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("custody.voucherTitle")}</p>
        </div>
        <div className="text-end">
          <p className="num text-lg font-bold text-foreground">#{data.serial}</p>
          <p className="num text-xs text-muted-foreground">{formatDate(data.date)}</p>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">{t("custody.supervisor")}</dt>
          <dd className="mt-1 font-medium text-foreground">{data.supervisorName}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("supervisors.nationalId")}</dt>
          <dd className="num mt-1 font-medium text-foreground">{data.nationalId}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("supervisors.phone")}</dt>
          <dd className="num mt-1 font-medium text-foreground">{data.phone}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("custody.project")}</dt>
          <dd className="mt-1 font-medium text-foreground">{data.projectName}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("custody.type")}</dt>
          <dd className="mt-1 font-medium text-foreground">{t(`custody.types.${data.type}`)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("common.status")}</dt>
          <dd className="mt-1 font-medium text-foreground">{t(`status.${data.status}`)}</dd>
        </div>
      </dl>

      <div className="rounded-lg border border-border bg-secondary/50 p-4">
        <p className="text-xs text-muted-foreground">{t("common.amount")}</p>
        <p className="num mt-1 text-2xl font-bold text-primary">
          {formatMoney(data.amount, locale)}
        </p>
      </div>

      {data.reversalOfSerial != null && (
        <p className="num text-sm text-foreground">
          {t("custody.reversalOf")} #{data.reversalOfSerial}
        </p>
      )}
      {data.reversedBySerial != null && (
        <p className="num text-sm text-foreground">
          {t("custody.reversedBy")} #{data.reversedBySerial}
        </p>
      )}

      {data.reason && (
        <div>
          <p className="text-xs text-muted-foreground">{t("common.reason")}</p>
          <p className="mt-1 text-sm text-foreground">{data.reason}</p>
        </div>
      )}
      {data.notes && (
        <div>
          <p className="text-xs text-muted-foreground">{t("common.notes")}</p>
          <p className="mt-1 text-sm text-foreground">{data.notes}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-8 pt-10 text-center text-sm">
        <div className="border-t border-border pt-2 text-muted-foreground">
          {t("custody.supervisor")}
        </div>
        <div className="border-t border-border pt-2 text-muted-foreground">
          {t("roles.accountant")}
        </div>
      </div>

      <p className="num pt-2 text-center text-[11px] text-muted-foreground">
        {formatDateTime(new Date())} · Asia/Riyadh
      </p>
    </div>
  );
}

export function CustodyVoucher({
  data,
  onClose,
}: {
  data: VoucherData | null;
  onClose: () => void;
}) {
  const { t } = useI18n();

  return (
    <>
      {data && (
        <PrintPortal>
          <VoucherSheet data={data} />
        </PrintPortal>
      )}

      <Dialog open={!!data} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("custody.voucherTitle")}</DialogTitle>
          </DialogHeader>

          {data && <VoucherSheet data={data} />}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              {t("common.close")}
            </Button>
            <Button className="gap-2" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden />
              {t("common.print")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
