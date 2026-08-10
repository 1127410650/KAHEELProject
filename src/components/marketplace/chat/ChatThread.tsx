import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, MessageSquare } from "lucide-react";

import { useI18n } from "@/i18n";
import { dayKeyInRiyadh, formatDate, todayInRiyadh } from "@/lib/format";
import type { ChatMessage } from "@/lib/mkt-chat";
import { ChatBubble } from "@/components/marketplace/chat/ChatBubble";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  /** Changing this re-anchors the view to the newest message. */
  conversationId: string;
  messages: ChatMessage[];
  loading: boolean;
  peerTyping: boolean;
  onChanged: () => void;
  onShareBank: (requestMessageId: string) => void;
  onRetry: (message: ChatMessage) => void;
}

/** Yesterday's YYYY-MM-DD in Asia/Riyadh, derived from today's key. */
function yesterdayKey(): string {
  const today = todayInRiyadh();
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

interface DayGroup {
  key: string;
  label: string;
  items: ChatMessage[];
}

const NEAR_BOTTOM_PX = 120;

export function ChatThread({
  conversationId,
  messages,
  loading,
  peerTyping,
  onChanged,
  onShareBank,
  onRetry,
}: Props) {
  const { t } = useI18n();
  const scroller = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const anchored = useRef<string | null>(null);

  const groups = useMemo<DayGroup[]>(() => {
    const today = todayInRiyadh();
    const yesterday = yesterdayKey();
    const out: DayGroup[] = [];
    for (const m of messages) {
      const key = dayKeyInRiyadh(m.created_at);
      const last = out[out.length - 1];
      if (last && last.key === key) {
        last.items.push(m);
        continue;
      }
      out.push({
        key,
        label:
          key === today
            ? t("market.chat.day.today")
            : key === yesterday
              ? t("market.chat.day.yesterday")
              : formatDate(m.created_at),
        items: [m],
      });
    }
    return out;
  }, [messages, t]);

  const scrollToEnd = useCallback((smooth: boolean) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Opening a thread always lands on the newest message.
  useLayoutEffect(() => {
    if (loading) return;
    if (anchored.current === conversationId) return;
    anchored.current = conversationId;
    setAtBottom(true);
    scrollToEnd(false);
  }, [conversationId, loading, scrollToEnd]);

  // New traffic only pulls the view down when the reader is already at the end,
  // so browsing older messages is never interrupted.
  useEffect(() => {
    if (atBottom) scrollToEnd(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, peerTyping]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX);
  }

  return (
    <div className="relative mt-3 min-h-0 flex-1">
      <div
        ref={scroller}
        onScroll={onScroll}
        className="h-full max-h-[52vh] overflow-y-auto overscroll-contain rounded-[var(--r-card)] border border-border bg-muted/30 p-3 lg:max-h-none"
      >
        {loading ? (
          // Fixed-height skeleton rows: same box as real bubbles, so no layout shift.
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={i % 2 ? "flex justify-end" : "flex justify-start"}>
                <Skeleton
                  className="h-14 rounded-[var(--r-card)]"
                  style={{ width: i % 3 === 0 ? "62%" : i % 3 === 1 ? "48%" : "72%" }}
                />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="grid h-full min-h-40 place-items-center text-center">
            <div className="max-w-xs space-y-2">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-background text-muted-foreground shadow-sm">
                <MessageSquare className="size-5" aria-hidden />
              </span>
              <p className="text-sm font-semibold text-foreground">
                {t("market.chat.emptyTitle")}
              </p>
              <p className="text-desc text-muted-foreground">{t("market.chat.emptyHint")}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <section key={group.key} aria-label={group.label}>
                <p className="mx-auto mb-3 w-fit rounded-full bg-background px-3 py-1 text-desc font-medium text-muted-foreground shadow-sm">
                  {group.label}
                </p>
                <ul className="flex flex-col gap-2">
                  {group.items.map((m) => (
                    <ChatBubble
                      key={m.id}
                      message={m}
                      onChanged={onChanged}
                      onRetry={onRetry}
                      onShareBank={onShareBank}
                    />
                  ))}
                </ul>
              </section>
            ))}

            {peerTyping && (
              <p
                className="flex w-fit items-center gap-1 rounded-[var(--r-card)] rounded-ss-sm bg-secondary px-3 py-2 text-desc text-secondary-foreground"
                aria-live="polite"
              >
                <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:120ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:240ms]" />
                <span className="ms-1">{t("market.chat.typing")}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {!atBottom && !loading && messages.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setAtBottom(true);
            scrollToEnd(true);
          }}
          aria-label={t("market.chat.jumpToLatest")}
          className="absolute bottom-3 end-3 grid size-9 place-items-center rounded-full border border-border bg-background text-foreground shadow-md"
        >
          <ArrowDown className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
