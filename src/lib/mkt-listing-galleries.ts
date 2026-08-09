/**
 * صور الإعلانات لبطاقات الأقسام: استعلام واحد مجمّع لكل الشبكة الظاهرة، لا
 * استعلام لكل بطاقة. تُستخدم لمعرض الصور الداخلي في بطاقة العقار.
 */
import { supabase } from "@/integrations/supabase/client";
import { resolveMedia } from "@/lib/mkt";

/** أقصى عدد صور نعرضه داخل البطاقة — يكفي للتقليب بلا إثقال الشبكة. */
export const CARD_GALLERY_LIMIT = 6;

export async function loadListingGalleries(
  listingIds: string[],
): Promise<Record<string, string[]>> {
  const ids = Array.from(new Set(listingIds.filter(Boolean)));
  if (ids.length === 0) return {};

  const { data } = await supabase
    .from("mkt_listing_images")
    .select("listing_id, url, sort_order")
    .in("listing_id", ids)
    .order("sort_order");

  const rows = (data ?? []) as { listing_id: string; url: string }[];
  const media = await resolveMedia(rows.map((row) => row.url));

  const result: Record<string, string[]> = {};
  for (const row of rows) {
    const url = media[row.url];
    if (!url) continue;
    const list = (result[row.listing_id] ??= []);
    if (list.length < CARD_GALLERY_LIMIT && !list.includes(url)) list.push(url);
  }
  return result;
}
