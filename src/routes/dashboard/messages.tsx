import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
  const [selected, setSelected] = useState<string | null>(c ?? null);
  const [body, setBody] = useState("");

  const conversations = useQuery({
    queryKey: ["mkt", "conversations"],
    queryFn: async () => {
      const { data } = await supabase
        .from("mkt_conversations")
        .select("id, listing_id, last_message_at, mkt_listings(title, slug)")
        .order("last_message_at", { ascending: false });
      return data ?? [];
    },
  });

  const messages = useQuery({
    queryKey: ["mkt", "messages", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase
        .from("mkt_messages")
        .select("id, body, sender_user_id, created_at")
        .eq("conversation_id", selected!)
        .order("created_at");
      return data ?? [];
    },
  });

  async function send() {
    if (!selected || !body.trim()) return;
    const { error } = await supabase
      .from("mkt_messages")
      .insert({ conversation_id: selected, body: body.trim() });
    if (error) {
      toast.error(t("market.actions.failed"));
      return;
    }
    setBody("");
    void messages.refetch();
  }

  return (
    <DashboardShell title={t("market.dash.messages")}>
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <ul className="space-y-2">
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
                </button>
              </li>
            );
          })}
          {!conversations.isLoading && (conversations.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">{t("market.dash.noMessages")}</p>
          )}
        </ul>

        <div className="rounded-xl border border-border bg-card p-4">
          {selected ? (
            <>
              <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
                {(messages.data ?? []).map((m) => (
                  <li
                    key={m.id}
                    className={
                      m.sender_user_id === session?.user.id
                        ? "ms-auto max-w-[85%] rounded-lg bg-primary p-2 text-sm text-primary-foreground"
                        : "me-auto max-w-[85%] rounded-lg bg-secondary p-2 text-sm text-secondary-foreground"
                    }
                  >
                    {m.body}
                  </li>
                ))}
              </ul>
              <div className="mt-3 space-y-2">
                <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
                <Button size="sm" onClick={() => void send()} disabled={!body.trim()}>
                  {t("market.actions.sendMessage")}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("market.dash.pickConversation")}</p>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
