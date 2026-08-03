/**
 * State machine behind the ad photo grid.
 *
 * Every picked file is validated, compressed and uploaded right away, so the
 * grid can show per-photo progress and let the advertiser retry only the photo
 * that failed. Order and cover live here too and are mirrored into the draft.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  attachedPath,
  attachObject,
  cleanupDraftFolder,
  MAX_LISTING_IMAGES,
  prepareFile,
  removeObjects,
  signPaths,
  stagingPath,
  toMeta,
  uploadWithProgress,
  type MediaError,
  type StagedImage,
  type StagedImageMeta,
} from "@/lib/mkt-listing-media";

interface Options {
  userId: string | null;
  draftId: string;
  listingId?: string | undefined;
}

export interface ListingImagesApi {
  items: StagedImage[];
  coverId: string | null;
  loading: boolean;
  addFiles: (files: File[]) => void;
  retry: (id: string) => void;
  remove: (id: string) => void;
  replace: (id: string, file: File) => void;
  reorder: (from: number, to: number) => void;
  setCover: (id: string) => void;
  restore: (metas: StagedImageMeta[], coverId: string | null) => void;
  /** Attach staged objects to the ad and persist rows; returns the cover path. */
  persist: (listingId: string) => Promise<string | null>;
  /** Drop every staged object of this draft (used after a successful save). */
  discardStaged: () => Promise<void>;
  readyCount: number;
  /** Photos that occupy a slot: uploaded or still uploading (rejects do not). */
  activeCount: number;
  metas: StagedImageMeta[];
}

export function useListingImages({ userId, draftId, listingId }: Options): ListingImagesApi {
  const [items, setItems] = useState<StagedImage[]>([]);
  const [coverId, setCoverId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!listingId);
  const removedStored = useRef<{ rowId: string; path: string }[]>([]);
  const itemsRef = useRef<StagedImage[]>([]);
  itemsRef.current = items;

  const patch = useCallback((id: string, next: Partial<StagedImage>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...next } : item)));
  }, []);

  // Photos already saved on the ad are edited in the same grid.
  useEffect(() => {
    if (!listingId) return;
    let alive = true;
    void (async () => {
      const { data } = await supabase
        .from("mkt_listing_images")
        .select("id, url, sort_order, is_cover")
        .eq("listing_id", listingId)
        .order("sort_order");
      const rows = data ?? [];
      const signed = await signPaths(rows.map((r) => r.url).filter((u) => !/^https?:/i.test(u)));
      if (!alive) return;
      const stored: StagedImage[] = rows.map((row) => ({
        id: `stored:${row.id}`,
        kind: "stored",
        storedId: row.id,
        path: row.url,
        name: row.url.split("/").pop() ?? "",
        bytes: 0,
        fingerprint: `stored:${row.id}`,
        status: "ready",
        progress: 100,
        preview: /^https?:/i.test(row.url) ? row.url : signed[row.url],
      }));
      setItems((prev) => [...stored, ...prev.filter((i) => i.kind === "staged")]);
      const cover = rows.find((r) => r.is_cover) ?? rows[0];
      setCoverId((prev) => prev ?? (cover ? `stored:${cover.id}` : null));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [listingId]);

  // A refreshed page has no File objects left: re-sign the stored paths.
  const restore = useCallback((metas: StagedImageMeta[], cover: string | null) => {
    if (metas.length === 0) return;
    setItems((prev) => {
      const known = new Set(prev.map((i) => i.fingerprint));
      const revived: StagedImage[] = metas
        .filter((meta) => !known.has(meta.fingerprint))
        .map((meta) => ({
          id: meta.id,
          kind: meta.kind,
          ...(meta.storedId ? { storedId: meta.storedId } : {}),
          path: meta.path,
          name: meta.name,
          bytes: meta.bytes,
          fingerprint: meta.fingerprint,
          status: "ready",
          progress: 100,
        }));
      return [...prev, ...revived];
    });
    setCoverId((prev) => prev ?? cover);
    void (async () => {
      const signed = await signPaths(metas.map((m) => m.path));
      setItems((prev) =>
        prev.map((item) =>
          item.path && signed[item.path] && !item.preview
            ? { ...item, preview: signed[item.path] }
            : item,
        ),
      );
    })();
  }, []);

  const uploadOne = useCallback(
    async (item: StagedImage, blob: Blob) => {
      if (!userId) {
        patch(item.id, { status: "failed", error: "upload" });
        return;
      }
      const path = stagingPath(userId, draftId, blob.type || "image/webp");
      try {
        await uploadWithProgress(path, blob, (percent) => patch(item.id, { progress: percent }));
        patch(item.id, { status: "ready", progress: 100, path, error: undefined });
      } catch {
        patch(item.id, { status: "failed", error: "upload" });
      }
    },
    [draftId, patch, userId],
  );

  const addFiles = useCallback(
    (files: File[]) => {
      void (async () => {
        for (const file of files) {
          const active = itemsRef.current.filter((i) => i.status !== "failed").length;
          if (active >= MAX_LISTING_IMAGES) {
            setItems((prev) => [
              ...prev,
              failedItem(file, "limit"),
            ]);
            break;
          }
          const id = crypto.randomUUID();
          const placeholder: StagedImage = {
            id,
            kind: "staged",
            path: null,
            name: file.name,
            bytes: file.size,
            fingerprint: `pending:${id}`,
            status: "uploading",
            progress: 0,
            preview: URL.createObjectURL(file),
          };
          setItems((prev) => [...prev, placeholder]);
          setCoverId((prev) => prev ?? id);

          const prepared = await prepareFile(file);
          if (prepared.error) {
            patch(id, { status: "failed", error: prepared.error });
            continue;
          }
          const duplicate = itemsRef.current.some(
            (other) => other.id !== id && other.fingerprint === prepared.fingerprint,
          );
          if (duplicate) {
            patch(id, { status: "failed", error: "duplicate" });
            continue;
          }
          patch(id, {
            fingerprint: prepared.fingerprint,
            blob: prepared.blob,
            hash: prepared.fingerprint,
            mime: prepared.mime,
            width: prepared.width,
            height: prepared.height,
          });
          await uploadOne({ ...placeholder, fingerprint: prepared.fingerprint }, prepared.blob);
        }
      })();
    },
    [patch, uploadOne],
  );

  const retry = useCallback(
    (id: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item?.blob) return;
      patch(id, { status: "uploading", progress: 0, error: undefined });
      void uploadOne(item, item.blob);
    },
    [patch, uploadOne],
  );

  const remove = useCallback((id: string) => {
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item) return;
    if (item.kind === "stored" && item.storedId && item.path)
      removedStored.current.push({ rowId: item.storedId, path: item.path });
    if (item.kind === "staged" && item.path) void removeObjects([item.path]);
    if (item.preview?.startsWith("blob:")) URL.revokeObjectURL(item.preview);
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      setCoverId((cover) =>
        cover === id ? (next.find((i) => i.status === "ready")?.id ?? null) : cover,
      );
      return next;
    });
  }, []);

  const replace = useCallback(
    (id: string, file: File) => {
      const index = itemsRef.current.findIndex((i) => i.id === id);
      if (index < 0) return;
      const wasCover = coverId === id;
      remove(id);
      void (async () => {
        addFiles([file]);
        if (wasCover) {
          // The new photo lands last; make it the cover again once it exists.
          window.setTimeout(() => {
            const last = itemsRef.current[itemsRef.current.length - 1];
            if (last) setCoverId(last.id);
          }, 0);
        }
      })();
    },
    [addFiles, coverId, remove],
  );

  const reorder = useCallback((from: number, to: number) => {
    setItems((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });
  }, []);

  const setCover = useCallback((id: string) => setCoverId(id), []);

  /** The first ready photo is the cover unless one was chosen explicitly. */
  const effectiveCover =
    items.find((i) => i.id === coverId && i.status === "ready")?.id ??
    items.find((i) => i.status === "ready")?.id ??
    null;

  const persist = useCallback(
    async (targetListing: string): Promise<string | null> => {
      if (!userId) return null;
      const ordered = itemsRef.current.filter((i) => i.status === "ready" && i.path);
      const coverTarget =
        ordered.find((i) => i.id === coverId)?.id ?? ordered[0]?.id ?? null;

      for (const gone of removedStored.current) {
        // Soft delete through the RPC: it re-checks ownership, re-picks the
        // cover and queues the object for the storage sweep.
        await supabase.rpc("mkt_listing_image_delete", {
          _listing: targetListing,
          _image: gone.rowId,
        });
        await removeObjects([gone.path]);
      }
      removedStored.current = [];

      let coverPath: string | null = null;
      const rowIds: string[] = [];
      let coverRow: string | null = null;
      for (const [index, item] of ordered.entries()) {
        const isCover = item.id === coverTarget;
        if (item.kind === "stored" && item.storedId) {
          await supabase
            .from("mkt_listing_images")
            // Cover flips through the RPC so the single-cover rule never trips.
            .update({ sort_order: index })
            .eq("id", item.storedId);
          rowIds.push(item.storedId);
          if (isCover) {
            coverPath = item.path;
            coverRow = item.storedId;
          }
          continue;
        }
        const target = attachedPath(userId, targetListing, item.blob?.type ?? "image/webp");
        const finalPath = await attachObject(item.path!, target);
        const { data } = await supabase
          .from("mkt_listing_images")
          .insert({
            listing_id: targetListing,
            url: finalPath,
            storage_key: finalPath,
            original_filename: item.name.slice(0, 120),
            mime_type: item.mime ?? item.blob?.type ?? null,
            byte_size: item.blob?.size ?? item.bytes,
            width: item.width ?? null,
            height: item.height ?? null,
            file_hash: item.hash ?? null,
            upload_status: "ready",
            sort_order: index,
            is_cover: false,
          })
          .select("id")
          .single();
        if (data) {
          patch(item.id, { kind: "stored", storedId: data.id, path: finalPath });
          rowIds.push(data.id);
          if (isCover) coverRow = data.id;
        }
        if (isCover) coverPath = finalPath;
      }

      // Order and cover are committed atomically server-side, never trusted
      // from the local grid alone.
      if (rowIds.length > 0)
        await supabase.rpc("mkt_listing_images_reorder", {
          _listing: targetListing,
          _ids: rowIds,
        });
      if (coverRow)
        await supabase.rpc("mkt_listing_image_set_cover", {
          _listing: targetListing,
          _image: coverRow,
        });
      return coverPath;
    },
    [coverId, patch, userId],
  );

  const discardStaged = useCallback(async () => {
    if (!userId) return;
    await cleanupDraftFolder(userId, draftId);
  }, [draftId, userId]);

  const metas = items.map(toMeta).filter((m): m is StagedImageMeta => !!m);

  return {
    items,
    coverId: effectiveCover,
    loading,
    addFiles,
    retry,
    remove,
    replace,
    reorder,
    setCover,
    restore,
    persist,
    discardStaged,
    readyCount: items.filter((i) => i.status === "ready").length,
    activeCount: items.filter((i) => i.status !== "failed").length,
    metas,
  };
}

function failedItem(file: File, error: MediaError): StagedImage {
  return {
    id: crypto.randomUUID(),
    kind: "staged",
    path: null,
    name: file.name,
    bytes: file.size,
    fingerprint: `rejected:${crypto.randomUUID()}`,
    status: "failed",
    progress: 0,
    error,
  };
}
