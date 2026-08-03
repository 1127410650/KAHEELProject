import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ImagePlus, Star, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { resolveMedia } from "@/lib/mkt";
import { Button } from "@/components/ui/button";

interface StoredImage {
  id: string;
  url: string;
  sort_order: number;
  is_cover: boolean;
  signed?: string | undefined;
}

interface Props {
  /** Present while editing an ad: its already uploaded photos are managed here. */
  listingId?: string | undefined;
  files: File[];
  onFilesChange: (files: File[]) => void;
  /** Index of the cover among the newly picked files (used when no stored cover). */
  coverIndex: number;
  onCoverIndexChange: (index: number) => void;
}

/**
 * Photos of an ad: multiple upload, reorder, delete and cover choice. Stored
 * photos of an existing ad are edited in place; new files are ordered locally
 * and uploaded on save.
 */
export function ListingImages({
  listingId,
  files,
  onFilesChange,
  coverIndex,
  onCoverIndexChange,
}: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  const stored = useQuery({
    queryKey: ["mkt", "listing-images", listingId],
    enabled: !!listingId,
    queryFn: async (): Promise<StoredImage[]> => {
      const { data } = await supabase
        .from("mkt_listing_images")
        .select("id, url, sort_order, is_cover")
        .eq("listing_id", listingId!)
        .order("sort_order");
      const rows = (data ?? []) as StoredImage[];
      const media = await resolveMedia(rows.map((r) => r.url));
      return rows.map((r) => ({ ...r, signed: media[r.url] }));
    },
  });

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const rows = stored.data ?? [];

  async function removeStored(row: StoredImage) {
    setBusy(true);
    try {
      await supabase.from("mkt_listing_images").delete().eq("id", row.id);
      if (row.is_cover && listingId) {
        const next = rows.find((r) => r.id !== row.id);
        await supabase
          .from("mkt_listings")
          .update({ cover_image_url: next?.url ?? null })
          .eq("id", listingId);
        if (next)
          await supabase.from("mkt_listing_images").update({ is_cover: true }).eq("id", next.id);
      }
      await stored.refetch();
    } finally {
      setBusy(false);
    }
  }

  async function makeCover(row: StoredImage) {
    if (!listingId) return;
    setBusy(true);
    try {
      await supabase
        .from("mkt_listing_images")
        .update({ is_cover: false })
        .eq("listing_id", listingId);
      await supabase.from("mkt_listing_images").update({ is_cover: true }).eq("id", row.id);
      await supabase.from("mkt_listings").update({ cover_image_url: row.url }).eq("id", listingId);
      await stored.refetch();
    } finally {
      setBusy(false);
    }
  }

  async function moveStored(index: number, direction: -1 | 1) {
    const target = rows[index + direction];
    const current = rows[index];
    if (!target || !current) return;
    setBusy(true);
    try {
      await supabase
        .from("mkt_listing_images")
        .update({ sort_order: target.sort_order })
        .eq("id", current.id);
      await supabase
        .from("mkt_listing_images")
        .update({ sort_order: current.sort_order })
        .eq("id", target.id);
      await stored.refetch();
    } finally {
      setBusy(false);
    }
  }

  function moveFile(index: number, direction: -1 | 1) {
    const next = [...files];
    const to = index + direction;
    if (to < 0 || to >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item!);
    onFilesChange(next);
    if (coverIndex === index) onCoverIndexChange(to);
    else if (coverIndex === to) onCoverIndexChange(index);
  }

  return (
    <div className="space-y-2">
      <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-dashed border-input px-3 py-3 text-sm text-muted-foreground">
        <ImagePlus className="size-4" aria-hidden />
        {t("market.dash.addImages")}
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            onFilesChange([...files, ...picked]);
            e.target.value = "";
          }}
        />
      </label>
      <p className="text-[11px] text-muted-foreground">{t("market.form.imagesHint")}</p>

      {rows.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {rows.map((row, index) => (
            <li key={row.id} className="relative">
              <img
                src={row.signed ?? ""}
                alt=""
                className="size-24 rounded-lg border border-border object-cover"
                loading="lazy"
              />
              {row.is_cover && (
                <span className="absolute bottom-1 start-1 rounded bg-primary px-1.5 text-[10px] text-primary-foreground">
                  {t("market.dash.cover")}
                </span>
              )}
              <div className="mt-1 flex items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  disabled={busy || index === 0}
                  aria-label={t("market.dash.moveEarlier")}
                  onClick={() => void moveStored(index, -1)}
                >
                  <ChevronRight className="size-4 rtl:hidden" aria-hidden />
                  <ChevronLeft className="hidden size-4 rtl:block" aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  disabled={busy || index === rows.length - 1}
                  aria-label={t("market.dash.moveLater")}
                  onClick={() => void moveStored(index, 1)}
                >
                  <ChevronLeft className="size-4 rtl:hidden" aria-hidden />
                  <ChevronRight className="hidden size-4 rtl:block" aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  disabled={busy || row.is_cover}
                  aria-label={t("market.dash.makeCover")}
                  onClick={() => void makeCover(row)}
                >
                  <Star className="size-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  disabled={busy}
                  aria-label={t("market.actions.remove")}
                  onClick={() => void removeStored(row)}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}-${index}`} className="relative">
              <img
                src={previews[index]}
                alt={file.name}
                className="size-24 rounded-lg border border-border object-cover"
              />
              {rows.length === 0 && coverIndex === index && (
                <span className="absolute bottom-1 start-1 rounded bg-primary px-1.5 text-[10px] text-primary-foreground">
                  {t("market.dash.cover")}
                </span>
              )}
              <div className="mt-1 flex items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  disabled={index === 0}
                  aria-label={t("market.dash.moveEarlier")}
                  onClick={() => moveFile(index, -1)}
                >
                  <ChevronRight className="size-4 rtl:hidden" aria-hidden />
                  <ChevronLeft className="hidden size-4 rtl:block" aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  disabled={index === files.length - 1}
                  aria-label={t("market.dash.moveLater")}
                  onClick={() => moveFile(index, 1)}
                >
                  <ChevronLeft className="size-4 rtl:hidden" aria-hidden />
                  <ChevronRight className="hidden size-4 rtl:block" aria-hidden />
                </Button>
                {rows.length === 0 && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    disabled={coverIndex === index}
                    aria-label={t("market.dash.makeCover")}
                    onClick={() => onCoverIndexChange(index)}
                  >
                    <Star className="size-4" aria-hidden />
                  </Button>
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label={t("market.actions.remove")}
                  onClick={() => {
                    const next = files.filter((_, i) => i !== index);
                    onFilesChange(next);
                    if (coverIndex >= next.length) onCoverIndexChange(0);
                  }}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
