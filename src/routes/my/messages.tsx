import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Ban,
  BellOff,
  Bell,
  Flag,
  MessageSquare,
  MoreVertical,
  Search,
  ShieldCheck,
} from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { useActiveAccount } from "@/lib/mkt-account";
import { formatDateTime } from "@/lib/format";
import {
  chatErrorKey,
  fetchContext,
  fetchConversations,
  fetchMessages,
  markRead,
  requestBank,
  setBlocked,
  setConversationState,
  type ConversationRow,
} from "@/lib/mkt-chat";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { ChatBubble } from "@/components/marketplace/chat/ChatBubble";
import { ChatComposer } from "@/components/marketplace/chat/ChatComposer";
import { ChatListingCard } from "@/components/marketplace/chat/ChatListingCard";
import { BankPickerDialog } from "@/components/marketplace/chat/BankPickerDialog";
import { ReportDialog } from "@/components/marketplace/ReportDialog";
import { CallButton } from "@/components/marketplace/CallButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MessagesSearch {
  c?: string | undefined;
}

export const Route = createFileRoute("/my/messages")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): MessagesSearch =>
    typeof search["c"] === "string" ? { c: search["c"] } : {},
  head: () => ({
    meta: [
      { title: "المحادثات — گحيل" },
      { name: "description", content: "محادثاتك مع المعلنين والمشترين حول إعلانات گحيل." },
      { property: "og:title", content: "المحادثات — گحيل" },
      { property: "og:description", content: "إدارة محادثات السوق." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MessagesPage,
});

/** One line of preview text for the rail, whatever the message kind was. */
function previewOf(row: ConversationRow, t: (key: string) => string): string {
  if (!row.last_kind) return t("market.chat.empty");
  const text =
    row.last_kind === "text" && row.last_body
      ? row.last_body
      : t(`market.chat.preview.${row.last_kind}`);
  return row.last_mine ? `${t("market.chat.preview.you")} ${text}` : text;
}

function MessagesPage() {
  const { t } = useI18n();
  const { c } = Route.useSearch();
  const navigate = useNavigate();
  const { session } = useSession();
  const { account } = useActiveAccount();
  const [selected, setSelected] = useState<string | null>(c ?? null);
  const [term, setTerm] = useState("");
  const [bankOpen, setBankOpen] = useState(false);
  const [bankRequestId, setBankRequestId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const scroller = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (c) setSelected(c);
  }, [c]);

  // The open thread lives in the URL so a refresh (or a shared link) reopens it.
  function open(id: string | null) {
    setSelected(id);
    void navigate({ to: "/my/messages", search: id ? { c: id } : {}, replace: true });
  }

  const conversations = useQuery({
    // The list is account-scoped on the server; the key follows the active account
    // so switching workspaces never shows the previous account's threads.
    queryKey: ["mkt", "conversations", account?.account_key],
    enabled: !!session && !!account,
    refetchInterval: 30000,
    queryFn: fetchConversations,
  });

  const rows = conversations.data ?? [];

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.peer_name} ${r.listing_title ?? ""} ${r.last_body ?? ""}`.toLowerCase().includes(q),
    );
  }, [rows, term]);

  // On desktop the reading pane is never empty: the newest thread opens by itself.
  useEffect(() => {
    if (selected || rows.length === 0) return;
    if (typeof window === "undefined" || !window.matchMedia("(min-width: 1024px)").matches) return;
    open(rows[0]!.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, selected]);

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

  // Opening a thread clears its unread badge for this viewer only.
  useEffect(() => {
    if (!selected || !messages.data) return;
    void markRead(selected).then(() => conversations.refetch());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, messages.data?.length]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.data]);

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
      void conversations.refetch();
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
      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* Side rail: on mobile it is the whole screen until a thread is opened. */}
        <section
          aria-label={t("market.chat.threads")}
          className={
            selected
              ? "hidden lg:flex lg:h-[calc(100vh-13rem)] lg:flex-col"
              : "flex flex-col lg:h-[calc(100vh-13rem)]"
          }
        >
          <div className="relative">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={t("market.chat.searchPlaceholder")}
              className="ps-9"
              aria-label={t("market.chat.searchPlaceholder")}
            />
          </div>

          <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pb-1">
            {conversations.isLoading &&
              [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[74px] w-full rounded-xl" />)}

            {filtered.map((row) => {
              const active = selected === row.id;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => open(row.id)}
                    aria-current={active ? "true" : undefined}
                    className={
                      active
                        ? "flex w-full items-start gap-3 rounded-xl border border-primary bg-accent p-3 text-start"
                        : "flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3 text-start hover:bg-accent"
                    }
                  >
                    {row.listing_cover ? (
                      <img
                        src={row.listing_cover}
                        alt=""
                        loading="lazy"
                        className="size-12 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span
                        className="grid size-12 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"
                        aria-hidden
                      >
                        <MessageSquare className="size-5" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                          {row.peer_name}
                        </span>
                        {row.muted && (
                          <BellOff className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        )}
                        {row.unread_count > 0 && (
                          <span
                            className="inline-flex min-w-5 shrink-0 justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground tabular-nums"
                            aria-label={t("market.chat.unread")}
                          >
                            {row.unread_count}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {row.listing_title ?? "—"}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-foreground/80">
                        {previewOf(row, t)}
                      </span>
                      {row.last_message_at && (
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {formatDateTime(row.last_message_at)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}

            {!conversations.isLoading && filtered.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {rows.length === 0 ? t("market.dash.noMessages") : t("market.chat.noResults")}
              </p>
            )}
          </ul>
        </section>

        {/* Reading pane */}
        <section className="min-w-0 lg:flex lg:h-[calc(100vh-13rem)] lg:flex-col">
          {selected && ctx ? (
            <>
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => open(null)}
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

              <div className="mt-3">
                <ChatListingCard context={ctx} />
              </div>

              <ul
                ref={scroller}
                className="mt-3 flex max-h-[52vh] min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-card p-3 lg:max-h-none"
              >
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

              <div className="sticky bottom-0 z-10 mt-3 bg-background/95 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:static lg:bg-transparent lg:pb-0 lg:backdrop-blur-none">
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
            </>
          ) : (
            <div className="hidden place-items-center rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground lg:grid lg:h-full">
              <span>
                <MessageSquare className="mx-auto mb-2 size-6" aria-hidden />
                {t("market.dash.pickConversation")}
              </span>
            </div>
          )}
        </section>
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
