import { useEffect, useState, type ReactNode } from "react";
import {
  Check,
  Copy,
  Download,
  Facebook,
  Mail,
  MessageCircle,
  QrCode,
  Send,
  Share2,
  Twitter,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

import { useI18n } from "@/i18n";
import { useIsMobile } from "@/hooks/use-mobile";
import { canonicalCurrentUrl, shareTargets } from "@/lib/share-links";
import { trackListingEvent, type ListingTrackKind } from "@/lib/mkt-listing-ops";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShareSheetProps {
  /** Text used as the share title (ad title, person or business name). */
  title: string;
  /** Canonical URL to share; defaults to the current page's canonical URL. */
  url?: string | undefined;
  /** When sharing a listing, its id — aggregate share counters are bumped. */
  listingId?: string | undefined;
  /** Trigger element (a button); receives the click handler through asChild. */
  children: ReactNode;
}

type Row = { key: string; label: string; icon: ReactNode; onSelect: () => void };

/** One shared share menu: bottom sheet on mobile, popover on desktop. */
export function ShareSheet({ title, url, listingId, children }: ShareSheetProps) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [canSystemShare, setCanSystemShare] = useState(false);

  // navigator.share only exists in the browser — checked after hydration.
  useEffect(() => {
    setCanSystemShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  /** Aggregate counters only; no per-visitor data is stored. */
  function track(kind: ListingTrackKind) {
    if (listingId) trackListingEvent(listingId, kind);
  }

  const link = url ?? canonicalCurrentUrl();

  const targets = shareTargets(title, link);

  function openExternal(href: string) {
    setOpen(false);
    window.open(href, "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success(t("market.ad.linkCopied"));
      setOpen(false);
    } catch {
      toast.error(t("market.actions.failed"));
    }
  }

  async function systemShare() {
    setOpen(false);
    try {
      await navigator.share({ title, text: title, url: link });
    } catch {
      /* dismissed by the user */
    }
  }

  async function showQr() {
    try {
      const data = await QRCode.toDataURL(link, { width: 512, margin: 1 });
      setQrData(data);
      setOpen(false);
      setQrOpen(true);
    } catch {
      toast.error(t("market.actions.failed"));
    }
  }

  const rows: Row[] = [
    {
      key: "copy",
      label: t("market.share.copyLink"),
      icon: copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />,
      onSelect: () => void copyLink(),
    },
    ...(canSystemShare
      ? [
          {
            key: "system",
            label: t("market.share.system"),
            icon: <Share2 className="size-4" aria-hidden />,
            onSelect: () => void systemShare(),
          },
        ]
      : []),
    {
      key: "whatsapp",
      label: t("market.share.whatsapp"),
      icon: <MessageCircle className="size-4" aria-hidden />,
      onSelect: () => openExternal(targets.whatsapp),
    },
    {
      key: "telegram",
      label: t("market.share.telegram"),
      icon: <Send className="size-4" aria-hidden />,
      onSelect: () => openExternal(targets.telegram),
    },
    {
      key: "x",
      label: t("market.share.x"),
      icon: <Twitter className="size-4" aria-hidden />,
      onSelect: () => openExternal(targets.x),
    },
    {
      key: "facebook",
      label: t("market.share.facebook"),
      icon: <Facebook className="size-4" aria-hidden />,
      onSelect: () => openExternal(targets.facebook),
    },
    {
      key: "email",
      label: t("market.share.email"),
      icon: <Mail className="size-4" aria-hidden />,
      onSelect: () => {
        setOpen(false);
        window.location.href = targets.email;
      },
    },
    {
      key: "qr",
      label: t("market.share.qr"),
      icon: <QrCode className="size-4" aria-hidden />,
      onSelect: () => void showQr(),
    },
  ];

  const list = (
    <ul className="flex flex-col">
      {rows.map((row) => (
        <li key={row.key}>
          <button
            type="button"
            onClick={row.onSelect}
            className="flex w-full min-h-11 items-center gap-2.5 rounded-md px-3 py-2 text-start text-sm text-foreground transition-colors hover:bg-accent"
          >
            <span className="shrink-0 text-muted-foreground">{row.icon}</span>
            <span className="min-w-0 truncate">{row.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );

  const qrDialog = (
    <Dialog open={qrOpen} onOpenChange={setQrOpen}>
      <DialogContent className="max-w-[min(22rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>{t("market.share.qrTitle")}</DialogTitle>
        </DialogHeader>
        {qrData && (
          <div className="flex flex-col items-center gap-3">
            <img
              src={qrData}
              alt={t("market.share.qrTitle")}
              className="size-48 max-w-full rounded-lg border border-border bg-background"
            />
            <p className="w-full break-all text-center text-xs text-muted-foreground" dir="ltr">
              {link}
            </p>
            <Button asChild variant="outline" size="sm" className="min-h-11 w-full">
              <a href={qrData} download="tahqaq-qr.png">
                <Download className="size-4" aria-hidden />
                {t("market.share.download")}
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>{children}</DrawerTrigger>
          <DrawerContent>
            <DrawerHeader className="pb-1">
              <DrawerTitle className="text-start text-base">{t("market.share.title")}</DrawerTitle>
            </DrawerHeader>
            <div className="max-h-[60vh] overflow-y-auto px-2 pb-6">{list}</div>
          </DrawerContent>
        </Drawer>
        {qrDialog}
      </>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-1">
          {list}
        </PopoverContent>
      </Popover>
      {qrDialog}
    </>
  );
}
