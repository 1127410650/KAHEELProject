import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Ban, BellOff, Bell, Flag, MoreVertical, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { useActiveAccount } from "@/lib/mkt-account";
import { formatDateTime } from "@/lib/format";
import {
  chatErrorKey,
  fetchContext,
  fetchMessages,
  requestBank,
  setBlocked,
  setConversationState,
} from "@/lib/mkt-chat";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { ChatBubble } from "@/components/marketplace/chat/ChatBubble";
import { ChatComposer } from "@/components/marketplace/chat/ChatComposer";
import { ChatListingCard } from "@/components/marketplace/chat/ChatListingCard";
import { BankPickerDialog } from "@/components/marketplace/chat/BankPickerDialog";
import { ReportDialog } from "@/components/marketplace/ReportDialog";
import { CallButton } from "@/components/marketplace/CallButton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MessagesSearch {
  c?: string | undefined;
}

export const Route = createFileRoute("/dashboard/messages")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): MessagesSearch =>
    typeof search["c"] === "string" ? { c: search["c"] } : {},
  head: () => ({
    meta: [
      { title: "المحادثات — سوق تحقّق" },
      { name: "description", content: "محادثاتك مع المعلنين والمشترين حول إعلانات سوق تحقّق." },
      { property: "og:title", content: "المحادثات — سوق تحقّق" },
      { property: "og:description", content: "إدارة محادثات السوق." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const { t } = useI18n();
  const { c } = Route.useSearch();
  const { session } = useSession();
  const { account } = useActiveAccount();
  const [selected, setSelected] = useState<string | null>(c ?? null);
  const [bankOpen, setBankOpen] = useState(false);
  const [bankRequestId, setBankRequestId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (c) setSelected(c);
  }, [c]);

  const conversations = useQuery({
    queryKey: ["mkt", "conversations", account?.account_key],
    enabled: !!session && !!account,
    queryFn: async () => {
      // Conversations are scoped to the active account: a business sees the
      // threads addressed to it, the personal account sees its own threads.
      let query = supabase
        .from("mkt_conversations")
        .select("id, listing_id, last_message_at, mkt_listings(title, slug)");
      query =
        account!.kind === "business"
          ? query.eq("seller_tenant_id", account!.tenant_id!)
          : query.or(
              `buyer_user_id.eq.${session!.user.id},and(seller_user_id.eq.${session!.user.id},seller_tenant_id.is.null)`,
            );
      const { data } = await query.order("last_message_at", { ascending: false });
      return data ?? [];
    },
  });

  const context = useQuery({
    queryKey: ["mkt", "conversation-context", selected],
    enabled: !!selected,
    queryFn: () => fetchContext(selected!),
  });

  const messages = useQuery({
    queryKey: ["mkt", "messages", selected],
    enabled: !!selected,
    refetchInterval: 15000,
    queryFn: () => fetchMessages(selected!),
  });

  function refresh() {
    void messages.refetch();
    void context.refetch();
    void conversations.refetch();
  }

  async function toggleMute() {
    if (!selected || !context.data) return;
    try {
      await setConversationState(selected, { muted: !context.data.muted });
      void context.refetch();
    } catch (error) {
      toast.error(t(chatErrorKey(error)));
    }
  }

  async function toggleBlock() {
    if (!selected || !context.data) return;
    try {
      await setBlocked(selected, !context.data.blocked);
      toast.success(
        context.data.blocked ? t("market.chat.unblocked") : t("market.chat.blockedDone"),
      );
      refresh();
    } catch (error) {
      toast.error(t(chatErrorKey(error)));
    }
  }

  async function askForBank() {
    if (!selected || !account) return;
    try {
      await requestBank(selected, account.account_key);
      refresh();
    } catch (error) {
      toast.error(t(chatErrorKey(error)));
    }
  }

  const ctx = context.data ?? null;

  return (
    <DashboardShell title={t("market.dash.messages")}>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <ul className={selected ? "hidden space-y-2 lg:block" : "space-y-2"}>
          {(conversations.data ?? []).map((conv) => {
            const listing = conv.mkt_listings as { title: string } | null;
            return (
              <li key={conv.id}>
                <button
                  type="button"
                  onClick={() => setSelected(conv.id)}
                  className={
                    selected === conv.id
                      ? "w-full rounded-lg border border-primary bg-accent p-3 text-start text-sm"
                      : "w-full rounded-lg border border-border bg-card p-3 text-start text-sm hover:bg-accent"
                  }
                >
                  <span className="line-clamp-2 font-medium text-foreground">
                    {listing?.title ?? "—"}
                  </span>
                  {conv.last_message_at && (
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {formatDateTime(conv.last_message_at)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {!conversations.isLoading && (conversations.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">{t("market.dash.noMessages")}</p>
          )}
        </ul>

        <div className="space-y-3">
          {selected && ctx ? (
            <>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setSelected(null)}
                >
                  {t("market.chat.back")}
                </Button>
                <p className="min-w-0 flex-1 truncate text-sm font-semibold">{ctx.peer_name}</p>
                {ctx.listing_id && !ctx.is_seller_side && (
                  <CallButton listingId={ctx.listing_id} className="h-9" />
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={t("market.chat.more")}>
                      <MoreVertical className="size-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => void toggleMute()}>
                      {ctx.muted ? (
                        <Bell className="size-4" aria-hidden />
                      ) : (
                        <BellOff className="size-4" aria-hidden />
                      )}
                      {ctx.muted ? t("market.chat.unmute") : t("market.chat.mute")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setReportOpen(true)}>
                      <Flag className="size-4" aria-hidden />
                      {t("market.chat.report")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void toggleBlock()}>
                      {ctx.blocked ? (
                        <ShieldCheck className="size-4" aria-hidden />
                      ) : (
                        <Ban className="size-4" aria-hidden />
                      )}
                      {ctx.blocked ? t("market.chat.unblock") : t("market.chat.block")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <ChatListingCard context={ctx} />

              <div className="rounded-xl border border-border bg-card p-3">
                <ul className="flex max-h-[52vh] flex-col gap-3 overflow-y-auto">
                  {(messages.data ?? []).map((m) => (
                    <ChatBubble
                      key={m.id}
                      message={m}
                      onChanged={refresh}
                      onShareBank={(requestId) => {
                        setBankRequestId(requestId);
                        setBankOpen(true);
                      }}
                    />
                  ))}
                  {!messages.isLoading && (messages.data ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">{t("market.chat.empty")}</p>
                  )}
                </ul>

                <div className="mt-3">
                  {ctx.blocked ? (
                    <p className="rounded-lg bg-muted p-3 text-center text-sm text-muted-foreground">
                      {t("market.chat.blockedNotice")}
                    </p>
                  ) : (
                    <ChatComposer
                      conversationId={selected}
                      onSent={refresh}
                      onBankShare={() => {
                        setBankRequestId(null);
                        setBankOpen(true);
                      }}
                      onBankRequest={() => void askForBank()}
                    />
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("market.dash.pickConversation")}</p>
          )}
        </div>
      </div>

      {selected && (
        <BankPickerDialog
          conversationId={selected}
          accountKey={account?.account_key ?? null}
          requestMessageId={bankRequestId}
          open={bankOpen}
          onOpenChange={setBankOpen}
          onShared={refresh}
        />
      )}

      {ctx?.listing_id && (
        <ReportDialog
          listingId={ctx.listing_id}
          listingTitle={ctx.listing_title ?? ""}
          open={reportOpen}
          onOpenChange={setReportOpen}
        />
      )}
    </DashboardShell>
  );
}
