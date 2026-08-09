/**
 * Outreach log for directory entities.
 *
 * The rule this file exists for: an entity is contacted once. Before any
 * message is opened the caller asks `lastOutreachAt`; after the message is
 * opened the click is recorded. No bulk sending happens here — one entity per
 * call, triggered by a human action.
 */
import { supabase } from "@/integrations/supabase/client";

export type OutreachChannel = "whatsapp" | "share" | "copy" | "email";

/** Days during which the same entity must not be contacted again. */
export const OUTREACH_COOLDOWN_DAYS = 90;

export interface OutreachRecord {
  channel: string;
  created_at: string;
}

/** Most recent recorded contact for one entity, or null when never contacted. */
export async function lastOutreach(placeSlug: string): Promise<OutreachRecord | null> {
  const { data, error } = await supabase
    .from("mkt_guide_outreach")
    .select("channel, created_at")
    .eq("place_slug", placeSlug)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data ?? null;
}

/** True while the entity is inside the cooldown window. */
export function isWithinCooldown(record: OutreachRecord | null): boolean {
  if (!record) return false;
  const sent = new Date(record.created_at).getTime();
  if (Number.isNaN(sent)) return false;
  return Date.now() - sent < OUTREACH_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Record one contact. Anonymous visitors are not logged (RLS owns the row to a
 * signed-in sender); the message itself still carries the intro links.
 */
export async function recordOutreach(input: {
  placeId?: string | null;
  placeSlug: string;
  channel: OutreachChannel;
  batchId?: string | null;
  note?: string | null;
}): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return;
  await supabase.from("mkt_guide_outreach").insert({
    place_id: input.placeId ?? null,
    place_slug: input.placeSlug,
    channel: input.channel,
    batch_id: input.batchId ?? null,
    note: input.note ?? null,
    sent_by: userId,
  });
}
