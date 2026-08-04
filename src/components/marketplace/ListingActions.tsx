import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flag, Heart, MapPin, MessageSquare, QrCode, Share2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { currentPath, loginHref, type MktAction, type MktListing } from "@/lib/mkt";
import { ReportDialog } from "@/components/marketplace/ReportDialog";
import { QrCodeButton } from "@/components/marketplace/QrCodeButton";
import { ShareSheet } from "@/components/marketplace/ShareSheet";
import { track } from "@/lib/analytics";
import { CallButton } from "@/components/marketplace/CallButton";
import { chatErrorKey, openConversation, sendMessage } from "@/lib/mkt-chat";

import { canonicalUrl } from "@/lib/share-links";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  listing: MktListing;
  /** Action requested through ?action= after signing in. */
  pendingAction?: string | undefined;
  /** "quick" = the icon row above the gallery; "panel" = contact buttons. */
  variant?: "panel" | "quick";
  /** Ready-made map link for the icon row; omitted when there is no safe place. */
  locationHref?: string | null | undefined;
}

export function ListingActions({ listing, pendingAction, variant = "panel", locationHref }: Props) {
  const { t } = useI18n();
  const { session } = useSession();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<MktAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const isOwner = session?.user.id === listing.owner_user_id;

  useEffect(() => {
    if (!session) return;
    void supabase
      .from("mkt_favorites")
      .select("listing_id")
      .eq("listing_id", listing.id)
      .maybeSingle()
      .then(({ data }) => setSaved(!!data));
  }, [session, listing.id]);

  // Re-open the action the visitor picked before signing in.
  useEffect(() => {
    if (!session || !pendingAction) return;
    if (pendingAction === "quote" || pendingAction === "contact") {
      setDialog("contact");
    } else if (pendingAction === "report") {
      setDialog("report");
    } else if (pendingAction === "save") {
      void toggleFavorite();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, pendingAction]);

  function gate(action: MktAction) {
    if (!session) {
      void navigate({ href: loginHref(currentPath().split("?")[0] ?? "/", action) });
      return false;
    }
    if (isOwner) {
      toast.error(t("market.actions.ownListing"));
      return false;
    }
    return true;
  }

  async function toggleFavorite() {
    if (!gate("save")) return;
    if (saved) {
      await supabase.from("mkt_favorites").delete().eq("listing_id", listing.id);
      setSaved(false);
      toast.success(t("market.actions.removedFromFavorites"));
      return;
    }
    const { error } = await supabase.from("mkt_favorites").insert({ listing_id: listing.id });
    if (error) {
      toast.error(t("market.actions.failed"));
      return;
    }
    setSaved(true);
    toast.success(t("market.actions.savedToFavorites"));
  }

  async function startConversation(body: string) {
    setBusy(true);
    try {
      // One thread per visitor and ad; the server enforces blocks and limits.
      const conversationId = await openConversation(listing.id);
      await sendMessage(conversationId, "text", body);
      toast.success(t("market.actions.messageSent"));
      setDialog(null);
      void navigate({ to: "/dashboard/messages", search: { c: conversationId } });
    } catch (error) {
      toast.error(t(chatErrorKey(error)));
    } finally {
      setBusy(false);
    }
  }


  // Compact icon row shown at the top of the ad: favourite, share, report.
  if (variant === "quick") {
    return (
      <>
        <div className="flex flex-wrap items-center gap-2">
          {!isOwner && (
            <button
              type="button"
              onClick={() => void toggleFavorite()}
              aria-label={saved ? t("market.actions.saved") : t("market.actions.save")}
              aria-pressed={saved}
              className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
            >
              <Heart
                className={saved ? "size-5 fill-current text-primary" : "size-5"}
                aria-hidden
              />
            </button>
          )}

          <ShareSheet
            title={listing.title}
            url={canonicalUrl(`/ads/${listing.slug ?? listing.id}`)}
            listingId={listing.id}
          >
            <button
              type="button"
              aria-label={t("market.ad.share")}
              className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
            >
              <Share2 className="size-5" aria-hidden />
            </button>
          </ShareSheet>

          {/* QR is its own action, never inside the share menu. */}
          <QrCodeButton
            url={canonicalUrl(`/ads/${listing.slug ?? listing.id}`)}
            listingId={listing.id}
          >
            <button
              type="button"
              aria-label={t("market.share.qr")}
              title={t("market.share.qr")}
              className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
            >
              <QrCode className="size-5" aria-hidden />
            </button>
          </QrCodeButton>

          {/* Location lives here, next to share: no card, no full-width button.
           * An approximate ad only ever links to a blurred point or a place. */}
          {locationHref && (
            <a
              href={locationHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("market.ad.openLocation")}
              title={t("market.ad.openLocation")}
              className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
            >
              <MapPin className="size-5" aria-hidden />
            </a>
          )}
          {!isOwner && (
            <button
              type="button"
              onClick={() => gate("report") && setDialog("report")}
              aria-label={t("market.actions.report")}
              className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
            >
              <Flag className="size-5" aria-hidden />
            </button>
          )}
        </div>
        <ReportDialog
          listingId={listing.id}
          listingTitle={listing.title}
          open={dialog === "report"}
          onOpenChange={(open) => !open && setDialog(null)}
        />
      </>
    );
  }

  // A visitor gets exactly one primary call to action; the real contact buttons
  // only appear once there is a session, so nothing is duplicated.
  if (!session) {
    return (
      <Button
        size="lg"
        className="w-full"
        onClick={() => {
          track({ event_type: "contact_click", path: "/ads", listing_id: listing.id });
          void navigate({ href: loginHref(currentPath().split("?")[0] ?? "/", "contact") });
        }}
      >
        {t("market.ad.signInToContact")}
      </Button>
    );
  }

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button size="lg" className="sm:col-span-2" onClick={() => {
            track({ event_type: "contact_click", path: "/ads", listing_id: listing.id });
            if (gate("contact")) setDialog("contact");
          }}>
          <MessageSquare className="size-4" aria-hidden />
          {t("market.actions.contact")}
        </Button>
        {/* Free in-platform voice call; hides itself when not available. */}
        {!isOwner && <CallButton listingId={listing.id} className="h-11 sm:col-span-2 sm:h-10" />}
      </div>

      <Dialog open={dialog === "contact"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("market.actions.contact")}</DialogTitle>
            <DialogDescription>{listing.title}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const body = String(new FormData(e.currentTarget).get("body") ?? "").trim();
              if (body) void startConversation(body);
            }}
          >
            <Textarea
              name="body"
              rows={4}
              required
              placeholder={t("market.actions.messagePlaceholder")}
            />
            <Button type="submit" className="w-full" disabled={busy}>
              {t("market.actions.sendMessage")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ReportDialog
        listingId={listing.id}
        listingTitle={listing.title}
        open={dialog === "report"}
        onOpenChange={(open) => !open && setDialog(null)}
      />
    </>
  );
}
