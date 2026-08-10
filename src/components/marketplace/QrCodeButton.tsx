import { useState, type ReactNode } from "react";
import { Download } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { canonicalCurrentUrl } from "@/lib/share-links";
import { trackListingEvent } from "@/lib/mkt-listing-ops";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface QrCodeButtonProps {
  /** URL encoded in the code; defaults to the current page's canonical URL. */
  url?: string | undefined;
  /** When the code points at a listing, its id — aggregate counter only. */
  listingId?: string | undefined;
  /** Trigger element (a button); receives the click handler through the wrapper. */
  children: ReactNode;
}

/**
 * Standalone QR code action. It is deliberately *not* part of the share menu:
 * sharing hands off to the device, a QR code is its own tool.
 */
export function QrCodeButton({ url, listingId, children }: QrCodeButtonProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<string | null>(null);

  const link = url ?? canonicalCurrentUrl();

  async function show() {
    try {
      setData(await QRCode.toDataURL(link, { width: 512, margin: 1 }));
      setOpen(true);
      if (listingId) trackListingEvent(listingId, "qr_open");
    } catch {
      toast.error(t("market.actions.failed"));
    }
  }

  return (
    <>
      <span onClick={() => void show()}>{children}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(22rem,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle>{t("market.share.qrTitle")}</DialogTitle>
          </DialogHeader>
          {data && (
            <div className="flex flex-col items-center gap-3">
              <img
                src={data}
                alt={t("market.share.qrTitle")}
                className="size-48 max-w-full rounded-lg border border-border bg-background"
              />
              <p className="w-full break-all text-center text-desc text-muted-foreground" dir="ltr">
                {link}
              </p>
              <Button asChild variant="outline" size="sm" className="min-h-11 w-full">
                <a href={data} download="tahqaq-qr.png">
                  <Download className="size-4" aria-hidden />
                  {t("market.share.download")}
                </a>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
