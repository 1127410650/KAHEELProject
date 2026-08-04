import { supabase } from "@/integrations/supabase/client";

/** Message kinds the marketplace composer can produce. */
export type ChatKind =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "location"
  | "contact"
  | "bank_request"
  | "bank_share"
  | "system";

export interface ChatMessage {
  id: string;
  sender_user_id: string | null;
  kind: ChatKind;
  body: string;
  payload: Record<string, unknown>;
  reply_to_id: string | null;
  created_at: string;
  read_at: string | null;
  deleted_at: string | null;
  mine: boolean;
}

export interface ChatContext {
  conversation_id: string;
  listing_id: string | null;
  listing_title: string | null;
  listing_slug: string | null;
  listing_price: number | null;
  listing_currency: string | null;
  listing_city: string | null;
  listing_cover: string | null;
  listing_status: string | null;
  peer_name: string;
  is_seller_side: boolean;
  blocked: boolean;
  muted: boolean;
  message_count: number;
}

export interface BankAccountOption {
  id: string;
  bank_name: string;
  beneficiary_name: string;
  last4: string;
  owner_label: string | null;
}

export const CHAT_BUCKET = "mkt-chat";

/** Upload limits, enforced client side and mirrored by the accepted mime lists. */
export const CHAT_LIMITS = {
  image: 5 * 1024 * 1024,
  video: 25 * 1024 * 1024,
  audio: 10 * 1024 * 1024,
  file: 10 * 1024 * 1024,
  audioSeconds: 300,
} as const;

export const CHAT_ACCEPT = {
  image: "image/jpeg,image/png,image/webp",
  video: "video/mp4,video/webm,video/quicktime",
  file: "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

export class ChatError extends Error {}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new ChatError(res.error.message);
  return res.data as T;
}

/** Opens (or reuses) the single conversation between the viewer and an ad. */
export async function openConversation(listingId: string): Promise<string> {
  const res = await supabase.rpc("mkt_conversation_open", { _listing_id: listingId });
  return unwrap(res) as unknown as string;
}

export async function fetchContext(conversationId: string): Promise<ChatContext | null> {
  const res = await supabase.rpc("mkt_conversation_context", { _conversation_id: conversationId });
  return (unwrap(res) as unknown as ChatContext | null) ?? null;
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const res = await supabase.rpc("mkt_messages_list", { _conversation_id: conversationId });
  return ((unwrap(res) as unknown as ChatMessage[]) ?? []).map((m) => ({
    ...m,
    payload: (m.payload ?? {}) as Record<string, unknown>,
  }));
}

export async function sendMessage(
  conversationId: string,
  kind: ChatKind,
  body = "",
  payload: Record<string, unknown> = {},
): Promise<string> {
  const res = await supabase.rpc("mkt_message_send", {
    _conversation_id: conversationId,
    _kind: kind,
    _body: body,
    _payload: payload as never,
  });
  return unwrap(res) as unknown as string;
}

function extensionOf(file: File): string {
  const fromName = file.name.includes(".") ? file.name.split(".").pop() : null;
  if (fromName && /^[a-z0-9]{2,5}$/i.test(fromName)) return fromName.toLowerCase();
  const fromType = file.type.split("/").pop();
  return (fromType ?? "bin").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

/** Uploads to the private chat bucket under the conversation folder, then posts the message. */
export async function sendAttachment(
  conversationId: string,
  kind: "image" | "video" | "audio" | "file",
  file: File,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const limit = CHAT_LIMITS[kind];
  if (file.size > limit) throw new ChatError("too_large");
  const path = `${conversationId}/${crypto.randomUUID()}.${extensionOf(file)}`;
  const up = await supabase.storage.from(CHAT_BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (up.error) throw new ChatError(up.error.message);
  return sendMessage(conversationId, kind, "", {
    path,
    name: file.name,
    size: file.size,
    mime: file.type,
    ...extra,
  });
}

const signedCache = new Map<string, { url: string; expires: number }>();

/** Private media is only ever reachable through a short-lived signed link. */
export async function signedUrl(path: string): Promise<string | null> {
  const hit = signedCache.get(path);
  if (hit && hit.expires > Date.now()) return hit.url;
  const { data } = await supabase.storage.from(CHAT_BUCKET).createSignedUrl(path, 3600);
  if (!data?.signedUrl) return null;
  signedCache.set(path, { url: data.signedUrl, expires: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

export async function sendLocation(
  conversationId: string,
  lat: number,
  lng: number,
  precision: "exact" | "approx",
  label?: string,
): Promise<string> {
  const round = (n: number) => (precision === "approx" ? Math.round(n * 100) / 100 : n);
  return sendMessage(conversationId, "location", "", {
    lat: round(lat),
    lng: round(lng),
    precision,
    label: label ?? null,
  });
}

export async function sendContact(
  conversationId: string,
  name: string,
  phone: string,
  note?: string,
): Promise<string> {
  return sendMessage(conversationId, "contact", "", { name, phone, note: note ?? null });
}

export async function bankAccountsFor(accountKey: string): Promise<BankAccountOption[]> {
  const res = await supabase.rpc("mkt_bank_accounts_for", { _account_key: accountKey });
  return (unwrap(res) as unknown as BankAccountOption[]) ?? [];
}

export async function requestBank(conversationId: string, accountKey: string): Promise<string> {
  const res = await supabase.rpc("mkt_bank_request_send", {
    _conversation_id: conversationId,
    _account_key: accountKey,
  });
  return unwrap(res) as unknown as string;
}

export async function respondBankRequest(
  messageId: string,
  action: "cancel" | "decline",
): Promise<void> {
  const res = await supabase.rpc("mkt_bank_request_respond", {
    _message_id: messageId,
    _action: action,
  });
  if (res.error) throw new ChatError(res.error.message);
}

export async function shareBank(
  conversationId: string,
  bankAccountId: string,
  accountKey: string,
  requestMessageId?: string | null,
): Promise<string> {
  const res = await supabase.rpc("mkt_bank_share", {
    _conversation_id: conversationId,
    _bank_account_id: bankAccountId,
    _account_key: accountKey,
    ...(requestMessageId ? { _request_message_id: requestMessageId } : {}),
  });
  return unwrap(res) as unknown as string;
}

export async function deleteMessage(messageId: string, scope: "me" | "all"): Promise<void> {
  const res = await supabase.rpc("mkt_message_delete", { _message_id: messageId, _scope: scope });
  if (res.error) throw new ChatError(res.error.message);
}

export async function setConversationState(
  conversationId: string,
  patch: { muted?: boolean; hidden?: boolean },
): Promise<void> {
  const res = await supabase.rpc("mkt_conversation_state_set", {
    _conversation_id: conversationId,
    ...(patch.muted === undefined ? {} : { _muted: patch.muted }),
    ...(patch.hidden === undefined ? {} : { _hidden: patch.hidden }),
  });
  if (res.error) throw new ChatError(res.error.message);
}

export async function setBlocked(conversationId: string, blocked: boolean): Promise<void> {
  const res = await supabase.rpc("mkt_chat_block_set", {
    _conversation_id: conversationId,
    _blocked: blocked,
  });
  if (res.error) throw new ChatError(res.error.message);
}

/** Maps the server error codes onto translation keys the UI already owns. */
export function chatErrorKey(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (raw.includes("content_blocked")) return "market.chat.errors.blockedContent";
  if (raw.includes("rate_limited")) return "market.chat.errors.rateLimited";
  if (raw.includes("blocked")) return "market.chat.errors.blocked";
  if (raw.includes("restricted")) return "market.chat.errors.restricted";
  if (raw.includes("too_large")) return "market.chat.errors.tooLarge";
  if (raw.includes("not_verified")) return "market.chat.errors.bankNotVerified";
  if (raw.includes("listing_unavailable")) return "market.chat.errors.listingUnavailable";
  return "market.actions.failed";
}

export interface ConversationRow {
  id: string;
  listing_id: string | null;
  listing_title: string | null;
  listing_slug: string | null;
  listing_cover: string | null;
  peer_name: string;
  last_message_at: string | null;
  last_kind: ChatKind | null;
  last_body: string | null;
  last_mine: boolean | null;
  unread_count: number;
  muted: boolean;
}

/** One round trip for the side rail: peer, ad, last message preview and unread. */
export async function fetchConversations(): Promise<ConversationRow[]> {
  const res = await supabase.rpc("mkt_conversations_list");
  return (unwrap(res) as unknown as ConversationRow[]) ?? [];
}

/** Read receipts are per viewer; it never changes the peer's state. */
export async function markRead(conversationId: string): Promise<void> {
  await supabase.rpc("mkt_conversation_mark_read", { _conversation_id: conversationId });
}
