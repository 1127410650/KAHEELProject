import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const CANONICAL_PROJECT_REF = "rgpnhzovtceitqxpiilf";
const BATCH_ID = "kaheel-live-preview-2026-08-09-v1";
const BUCKET = "mkt-media";
const CONFIRMATION = "RESTORE_KAHEEL_PREVIEW_IMAGES";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ACCOUNTS = {
  customer: {
    email: "kaheel.preview.customer@example.com",
    passwordEnv: "KAHEEL_PREVIEW_CUSTOMER_PASSWORD",
  },
  store: {
    email: "kaheel.preview.store@example.com",
    passwordEnv: "KAHEEL_PREVIEW_STORE_PASSWORD",
  },
  provider: {
    email: "kaheel.preview.provider@example.com",
    passwordEnv: "KAHEEL_PREVIEW_PROVIDER_PASSWORD",
  },
  admin: {
    email: "kaheel.preview.admin@example.com",
    passwordEnv: "KAHEEL_PREVIEW_ADMIN_PASSWORD",
  },
};

const LISTINGS = [
  {
    id: "d9500000-0000-4000-8000-000000000001",
    account: "customer",
    title: "حفار مستعمل موديل 2019 بحالة جيدة",
    asset: "src/assets/market/cat-equipment.webp",
  },
  {
    id: "d9500000-0000-4000-8000-000000000002",
    account: "customer",
    title: "خلاطة خرسانة متنقلة للإيجار اليومي",
    asset: "src/assets/market/cat-equipment.webp",
  },
  {
    id: "d9500000-0000-4000-8000-000000000003",
    account: "customer",
    title: "كمية أنابيب PVC جديدة مقاس 4 بوصة",
    asset: "src/assets/market/cat-suppliers.webp",
  },
  {
    id: "d9500000-0000-4000-8000-000000000004",
    account: "store",
    title: "خرسانة جاهزة مقاومة 30 ميجا",
    asset: "src/assets/market/cat-suppliers.webp",
  },
  {
    id: "d9500000-0000-4000-8000-000000000005",
    account: "store",
    title: "أسمنت بورتلاندي 50 كجم",
    asset: "src/assets/market/cat-suppliers.webp",
  },
  {
    id: "d9500000-0000-4000-8000-000000000006",
    account: "store",
    title: "أنابيب PVC مقاس 4 بوصة",
    asset: "src/assets/market/cat-suppliers.webp",
  },
  {
    id: "d9500000-0000-4000-8000-000000000007",
    account: "provider",
    title: "صيانة وتنظيف مكيف سبليت داخل الرياض",
    asset: "src/assets/market/cat-home-services.webp",
  },
  {
    id: "d9500000-0000-4000-8000-000000000008",
    account: "provider",
    title: "كشف تسربات وصيانة سباكة منزلية",
    asset: "src/assets/market/cat-home-services.webp",
  },
  {
    id: "d9500000-0000-4000-8000-000000000009",
    account: "provider",
    title: "صيانة منزلية عامة بالموعد",
    asset: "src/assets/market/cat-home-services.webp",
  },
];

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function canonicalConfig() {
  const source = await readFile(
    path.join(ROOT, "src/integrations/supabase/public-config.ts"),
    "utf8",
  );
  const url = source.match(/CANONICAL_SUPABASE_URL\s*=\s*"([^"]+)"/)?.[1];
  const key = source.match(/CANONICAL_SUPABASE_PUBLISHABLE_KEY\s*=\s*"([^"]+)"/)?.[1];
  if (!url || !key) throw new Error("Canonical Supabase public configuration is missing");
  if (new URL(url).hostname !== `${CANONICAL_PROJECT_REF}.supabase.co`) {
    throw new Error(`Refusing non-canonical Supabase URL: ${url}`);
  }
  return { url, key };
}

function clientFor(url, key) {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function signIn(url, key, account) {
  const client = clientFor(url, key);
  const { data, error } = await client.auth.signInWithPassword({
    email: account.email,
    password: required(account.passwordEnv),
  });
  if (error || !data.user) throw error ?? new Error(`No user returned for ${account.email}`);
  return { client, user: data.user };
}

async function downloadHash(client, storagePath) {
  const { data, error } = await client.storage.from(BUCKET).download(storagePath);
  if (error || !data) return null;
  return sha256(Buffer.from(await data.arrayBuffer()));
}

async function publicDownloadCheck(client, storagePath, expectedHash) {
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(storagePath, 60);
  if (error || !data?.signedUrl) throw error ?? new Error(`No signed URL for ${storagePath}`);
  const response = await fetch(data.signedUrl);
  if (!response.ok)
    throw new Error(`Public download failed for ${storagePath}: HTTP ${response.status}`);
  const actualHash = sha256(Buffer.from(await response.arrayBuffer()));
  if (actualHash !== expectedHash) throw new Error(`Downloaded bytes differ for ${storagePath}`);
}

async function restoreRow(entry, session, adminClient) {
  const { client, user } = session;
  const expectedEmail = ACCOUNTS[entry.account].email;
  if (user.email?.toLowerCase() !== expectedEmail) {
    throw new Error(`Authenticated identity mismatch for ${entry.id}`);
  }

  const { data: listing, error: listingError } = await client
    .from("mkt_listings")
    .select("id,title,status,qa_batch_id,owner_user_id,cover_image_url")
    .eq("id", entry.id)
    .eq("owner_user_id", user.id)
    .eq("qa_batch_id", BATCH_ID)
    .single();
  if (listingError || !listing) throw listingError ?? new Error(`Missing listing ${entry.id}`);
  if (listing.title !== entry.title || listing.status !== "published") {
    throw new Error(`Listing identity or status changed for ${entry.id}`);
  }

  const { data: images, error: imagesError } = await client
    .from("mkt_listing_images")
    .select(
      "id,url,storage_key,thumbnail_key,original_filename,mime_type,byte_size,width,height,file_hash,upload_status,qa_batch_id",
    )
    .eq("listing_id", entry.id)
    .is("deleted_at", null);
  if (imagesError) throw imagesError;
  if (images?.length !== 1) {
    throw new Error(`Expected exactly one image row for ${entry.id}, found ${images?.length ?? 0}`);
  }

  const image = images[0];
  const bytes = await readFile(path.join(ROOT, entry.asset));
  const fileHash = sha256(bytes);
  const storagePath = `listings/${user.id}/${entry.id}/kaheel-project-cover-v1.webp`;
  const alreadyLinked =
    image.storage_key === storagePath && listing.cover_image_url === storagePath;
  const existingHash = await downloadHash(client, storagePath);

  if (alreadyLinked && existingHash === fileHash) {
    return { entry, imageId: image.id, storagePath, fileHash, state: "already-restored" };
  }
  if (existingHash && existingHash !== fileHash) {
    throw new Error(`Existing canonical object has unexpected bytes: ${storagePath}`);
  }

  if (!existingHash) {
    const { error: uploadError } = await client.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: "image/webp",
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) throw uploadError;
  }

  const { data: updatedImage, error: imageUpdateError } = await client
    .from("mkt_listing_images")
    .update({
      url: storagePath,
      storage_key: storagePath,
      thumbnail_key: null,
      original_filename: path.basename(entry.asset),
      mime_type: "image/webp",
      byte_size: bytes.byteLength,
      width: 768,
      height: 576,
      file_hash: fileHash,
      upload_status: "ready",
      qa_batch_id: BATCH_ID,
    })
    .eq("id", image.id)
    .eq("listing_id", entry.id)
    .select("id,storage_key")
    .single();
  if (imageUpdateError || updatedImage?.storage_key !== storagePath) {
    throw imageUpdateError ?? new Error(`Image row did not update for ${entry.id}`);
  }

  // Use the project's existing cover RPC. The QA admin is required because
  // these intentionally realistic preview businesses predate the later
  // business-completeness trigger; no trigger or validation is bypassed.
  const { error: coverError } = await adminClient.rpc("mkt_listing_image_set_cover", {
    _listing: entry.id,
    _image: image.id,
  });
  if (coverError) throw coverError;

  const { data: updatedListing, error: listingUpdateError } = await client
    .from("mkt_listings")
    .select("id,cover_image_url")
    .eq("id", entry.id)
    .single();
  if (listingUpdateError || updatedListing?.cover_image_url !== storagePath) {
    throw listingUpdateError ?? new Error(`Listing cover did not update for ${entry.id}`);
  }

  return {
    entry,
    imageId: image.id,
    storagePath,
    fileHash,
    state: "restored",
  };
}

async function main() {
  if (process.env.KAHEEL_IMAGE_RESTORE_CONFIRM !== CONFIRMATION) {
    throw new Error(`Set KAHEEL_IMAGE_RESTORE_CONFIRM=${CONFIRMATION} to apply this repair`);
  }

  const { url, key } = await canonicalConfig();
  const sessions = {};
  for (const [name, account] of Object.entries(ACCOUNTS)) {
    sessions[name] = await signIn(url, key, account);
  }

  const results = [];
  try {
    for (const entry of LISTINGS) {
      results.push(await restoreRow(entry, sessions[entry.account], sessions.admin.client));
    }

    const publicClient = clientFor(url, key);
    for (const result of results) {
      await publicDownloadCheck(publicClient, result.storagePath, result.fileHash);
    }

    const customerResult = results.find((result) => result.entry.account === "customer");
    const storeClient = sessions.store.client;
    const { data: crossRows, error: crossUpdateError } = await storeClient
      .from("mkt_listing_images")
      .update({ sort_order: 0 })
      .eq("id", customerResult.imageId)
      .select("id");
    if (crossUpdateError || (crossRows?.length ?? 0) !== 0) {
      throw crossUpdateError ?? new Error("Cross-account image update was not blocked");
    }

    await sessions.provider.client.storage.from(BUCKET).remove([customerResult.storagePath]);
    await publicDownloadCheck(publicClient, customerResult.storagePath, customerResult.fileHash);

    const { data: publicListings, error: publicListingsError } = await publicClient
      .from("mkt_listings")
      .select("id,cover_image_url,mkt_listing_images(id,storage_key)")
      .eq("qa_batch_id", BATCH_ID)
      .order("id");
    if (publicListingsError) throw publicListingsError;
    if (publicListings?.length !== LISTINGS.length) {
      throw new Error(
        `Expected ${LISTINGS.length} public listings, found ${publicListings?.length ?? 0}`,
      );
    }
    for (const listing of publicListings) {
      if (listing.mkt_listing_images?.length !== 1) {
        throw new Error(`Image row count changed for ${listing.id}`);
      }
      if (listing.cover_image_url !== listing.mkt_listing_images[0].storage_key) {
        throw new Error(`Cover and image path differ for ${listing.id}`);
      }
    }

    process.stdout.write(
      `${JSON.stringify(
        {
          projectRef: CANONICAL_PROJECT_REF,
          batchId: BATCH_ID,
          listings: results.length,
          restored: results.filter((result) => result.state === "restored").length,
          alreadyRestored: results.filter((result) => result.state === "already-restored").length,
          publicDownloads: results.length,
          imageRowsPerListing: 1,
          crossAccountWriteBlocked: true,
          sources: [...new Set(LISTINGS.map((entry) => entry.asset))],
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await Promise.all(
      Object.values(sessions).map(({ client }) => client.auth.signOut({ scope: "local" })),
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
