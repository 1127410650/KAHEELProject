import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { useIsMobile } from "@/hooks/use-mobile";
import { canonicalCurrentUrl } from "@/lib/share-links";
import { trackListingEvent, type ListingTrackKind } from "@/lib/mkt-listing-ops";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ShareSheetProps {
  /** Text used as the share title (ad title, person or business name). */
  title: string;
  /** Canonical URL to share; defaults to the current page's canonical URL. */
  url?: string | undefined;
  /** When sharing a listing, its id — aggregate share counters are bumped. */
  listingId?: string | undefined;
  /** Trigger element (a button); receives the click handler through asChild. */
  children?: ReactNode;
  /** Controlled mode: lets a parent menu open the sheet without its own trigger. */
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
}

type Row = { key: string; label: string; icon: ReactNode; onSelect: () => void };

/**
 * One share menu across the platform, deliberately minimal: copy the link, or
 * hand off to the device's own share sheet. App names (WhatsApp, Telegram, X…)
 * are never listed here — the operating system already knows what is installed.
 */
export function ShareSheet({
  title,
  url,
  listingId,
  children,
  open: openProp,
  onOpenChange,
}: ShareSheetProps) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [openState, setOpenState] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canSystemShare, setCanSystemShare] = useState(false);

  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };

  // navigator.share only exists in the browser — checked after hydration.
  useEffect(() => {
    setCanSystemShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  /** Aggregate counters only; no per-visitor data is stored. */
  function track(kind: ListingTrackKind) {
    if (listingId) trackListingEvent(listingId, kind);
  }

  const link = url ?? canonicalCurrentUrl();

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      track("link_copy");
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
      track("share");
    } catch {
      /* dismissed by the user */
    }
  }

  const rows: Row[] = [
    {
      key: "copy",
      label: t("market.share.copyLink"),
      icon: copied ? (
        <Check className="size-4" aria-hidden />
      ) : (
        <Copy className="size-4" aria-hidden />
      ),
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
  ];

  const list = (
    <ul className="flex flex-col">
      {rows.map((row) => (
        <li key={row.key}>
          <button
            type="button"
            onClick={row.onSelect}
            className="flex w-full min-h-11 items-center gap-[var(--sp-3)] rounded-md px-3 py-2 text-start text-sm text-foreground transition-colors hover:bg-accent"
          >
            <span className="shrink-0 text-muted-foreground">{row.icon}</span>
            <span className="min-w-0 truncate">{row.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        {children && <DrawerTrigger asChild>{children}</DrawerTrigger>}
        <DrawerContent>
          <DrawerHeader className="pb-1">
            <DrawerTitle className="text-start text-base">{t("market.share.title")}</DrawerTitle>
          </DrawerHeader>
          <div className="px-2 pb-6">{list}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Controlled mode without a trigger (opened from a card's ⋯ menu): a popover
  // has nothing to anchor to, so show the same two rows in a small dialog.
  if (!children) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(20rem,calc(100vw-2rem))] p-3">
          <DialogHeader>
            <DialogTitle className="text-start text-base">{t("market.share.title")}</DialogTitle>
          </DialogHeader>
          {list}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1">
        {list}
      </PopoverContent>
    </Popover>
  );
}
