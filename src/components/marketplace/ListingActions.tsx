import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flag, Heart, MapPin, MessageSquare, ReceiptText, Share2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { currentPath, loginHref, SA_CITIES, type MktAction, type MktListing } from "@/lib/mkt";
import { ReportDialog } from "@/components/marketplace/ReportDialog";
import { ShareSheet } from "@/components/marketplace/ShareSheet";
import { canonicalUrl } from "@/lib/share-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function ListingActions({
  listing,
  pendingAction,
  variant = "panel",
  locationHref,
}: Props) {

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
    if (pendingAction === "quote" || pendingAction === "contact" || pendingAction === "report") {
      setDialog(pendingAction);
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
      const { data: existing } = await supabase
        .from("mkt_conversations")
        .select("id")
        .eq("listing_id", listing.id)
        .eq("buyer_user_id", session!.user.id)
        .maybeSingle();

      let conversationId = existing?.id;
      if (!conversationId) {
        const { data, error } = await supabase
          .from("mkt_conversations")
          .insert({ listing_id: listing.id })
          .select("id")
          .single();
        if (error || !data) throw error ?? new Error("insert failed");
        conversationId = data.id;
      }
      const { error: msgError } = await supabase
        .from("mkt_messages")
        .insert({ conversation_id: conversationId, body });
      if (msgError) throw msgError;

      toast.success(t("market.actions.messageSent"));
      setDialog(null);
      void navigate({ to: "/dashboard/messages", search: { c: conversationId } });
    } catch {
      toast.error(t("market.actions.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function submitQuote(form: HTMLFormElement) {
    const fd = new FormData(form);
    setBusy(true);
    try {
      const { error } = await supabase.from("mkt_quote_requests").insert({
        listing_id: listing.id,
        title: String(fd.get("title") ?? ""),
        description: String(fd.get("description") ?? ""),
        quantity: fd.get("quantity") ? Number(fd.get("quantity")) : null,
        unit: (fd.get("unit") as string) || null,
        city: (fd.get("city") as string) || null,
        location_note: (fd.get("location_note") as string) || null,
        needed_date: (fd.get("needed_date") as string) || null,
        budget: fd.get("budget") ? Number(fd.get("budget")) : null,
        contact_phone: (fd.get("contact_phone") as string) || null,
        contact_preference: (fd.get("contact_preference") as string) || "in_app",
      });
      if (error) throw error;
      toast.success(t("market.actions.quoteSent"));
      setDialog(null);
      void navigate({ to: "/dashboard/requests" });
    } catch {
      toast.error(t("market.actions.failed"));
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
          >
            <button
              type="button"
              aria-label={t("market.ad.share")}
              className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
            >
              <Share2 className="size-5" aria-hidden />
            </button>
          </ShareSheet>
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
        onClick={() =>
          void navigate({ href: loginHref(currentPath().split("?")[0] ?? "/", "contact") })
        }
      >
        {t("market.ad.signInToContact")}
      </Button>
    );
  }

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          size="lg"
          className="sm:col-span-2"
          onClick={() => gate("quote") && setDialog("quote")}
        >
          <ReceiptText className="size-4" aria-hidden />
          {t("market.actions.requestQuote")}
        </Button>
        <Button
          variant="secondary"
          className="sm:col-span-2"
          onClick={() => gate("contact") && setDialog("contact")}
        >
          <MessageSquare className="size-4" aria-hidden />
          {t("market.actions.contact")}
        </Button>
      </div>



      <Dialog open={dialog === "quote"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("market.actions.requestQuote")}</DialogTitle>
            <DialogDescription>{listing.title}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submitQuote(e.currentTarget);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="title">{t("market.quote.title")}</Label>
              <Input id="title" name="title" required defaultValue={listing.title} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">{t("market.quote.description")}</Label>
              <Textarea id="description" name="description" rows={3} required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="quantity">{t("market.quote.quantity")}</Label>
                <Input id="quantity" name="quantity" dir="ltr" inputMode="decimal" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unit">{t("market.quote.unit")}</Label>
                <Input id="unit" name="unit" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="city">{t("market.quote.city")}</Label>
                <select
                  id="city"
                  name="city"
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  defaultValue={listing.city ?? ""}
                >
                  <option value="">{t("market.filters.allCities")}</option>
                  {SA_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="needed_date">{t("market.quote.neededDate")}</Label>
                <Input id="needed_date" name="needed_date" type="date" dir="ltr" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location_note">{t("market.quote.locationNote")}</Label>
              <Input id="location_note" name="location_note" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="budget">{t("market.quote.budget")}</Label>
                <Input id="budget" name="budget" dir="ltr" inputMode="decimal" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact_phone">{t("market.quote.phone")}</Label>
                <Input id="contact_phone" name="contact_phone" dir="ltr" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact_preference">{t("market.quote.contactPreference")}</Label>
              <select
                id="contact_preference"
                name="contact_preference"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                defaultValue="in_app"
              >
                <option value="in_app">{t("market.quote.prefInApp")}</option>
                <option value="phone">{t("market.quote.prefPhone")}</option>
                <option value="whatsapp">{t("market.quote.prefWhatsapp")}</option>
                <option value="email">{t("market.quote.prefEmail")}</option>
              </select>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {t("market.actions.sendQuote")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

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
