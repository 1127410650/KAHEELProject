import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const CONFIRMATION = "CREATE_KAHLI_QA_ACCOUNTS";
const QA_BATCH = "kahli-qa-accounts-v1";

function required(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function password() {
  return `Kh!${randomBytes(18).toString("base64url")}9a`;
}

function slugPart(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const supabaseUrl = required("SUPABASE_URL", process.env.VITE_SUPABASE_URL);
const serviceRoleKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) {
  throw new Error(
    "Missing required environment variable: SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)",
  );
}
const emailDomain = required("KAHLI_QA_EMAIL_DOMAIN");

if (process.env.KAHLI_QA_CONFIRM !== CONFIRMATION) {
  throw new Error(`Set KAHLI_QA_CONFIRM=${CONFIRMATION} to create or reset QA users.`);
}

const publishStores = process.env.KAHLI_QA_PUBLISH_STORES === "1";
const prefix = slugPart(process.env.KAHLI_QA_EMAIL_PREFIX || "kahli-qa");
const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const definitions = [
  { key: "customer", fullName: "حساب الإعلانات التجريبي", kind: "customer" },
  { key: "seller", fullName: "متجر البائع التجريبي", kind: "retail" },
  { key: "provider", fullName: "مقدم الخدمة التجريبي", kind: "services" },
  { key: "admin", fullName: "إدارة كحلي التجريبية", kind: "admin" },
];

async function listUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

async function ensureUser(definition, existingUsers) {
  const email = `${prefix}-${definition.key}@${emailDomain}`;
  const nextPassword = password();
  let user = existingUsers.find((candidate) => candidate.email?.toLowerCase() === email);

  if (user) {
    const { data, error } = await client.auth.admin.updateUserById(user.id, {
      password: nextPassword,
      email_confirm: true,
      user_metadata: { full_name: definition.fullName, kahli_qa: true },
    });
    if (error) throw error;
    user = data.user;
  } else {
    const { data, error } = await client.auth.admin.createUser({
      email,
      password: nextPassword,
      email_confirm: true,
      user_metadata: { full_name: definition.fullName, kahli_qa: true },
    });
    if (error) throw error;
    user = data.user;
  }

  const { error: profileError } = await client.from("profiles").upsert(
    {
      user_id: user.id,
      full_name: definition.fullName,
      email,
      locale: "ar",
      is_active: true,
    },
    { onConflict: "user_id" },
  );
  if (profileError) throw profileError;

  return { definition, email, password: nextPassword, userId: user.id };
}

async function ensureStore(account) {
  const isService = account.definition.kind === "services";
  const storeSlug = `${prefix}-${account.definition.kind}`;
  const storeName = isService ? "بيت الخبرة للخدمات" : "متجر كحلي التجريبي";
  const status = publishStores ? "published" : "draft";

  const { data: current, error: currentError } = await client
    .from("mkt_storefronts")
    .select("id")
    .eq("owner_user_id", account.userId)
    .is("tenant_id", null)
    .is("deleted_at", null)
    .maybeSingle();
  if (currentError) throw currentError;

  const payload = {
    owner_user_id: account.userId,
    tenant_id: null,
    store_type: account.definition.kind,
    slug: storeSlug,
    name_ar: storeName,
    name_en: isService ? "Kahli Service Studio" : "Kahli QA Store",
    short_description_ar: isService
      ? "متجر تجريبي لاختبار الحجز وإدارة المواعيد"
      : "متجر تجريبي لاختبار الكتالوج وطلبات البائع",
    pickup_enabled: !isService,
    merchant_delivery_enabled: false,
    platform_delivery_enabled: false,
    accepts_orders: true,
    is_open_manually: true,
    status,
    currency_code: "SAR",
    qa_batch_id: QA_BATCH,
  };

  let storefrontId = current?.id;
  if (storefrontId) {
    const { error } = await client.from("mkt_storefronts").update(payload).eq("id", storefrontId);
    if (error) throw error;
  } else {
    const { data, error } = await client
      .from("mkt_storefronts")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    storefrontId = data.id;
  }

  const itemPayload = {
    storefront_id: storefrontId,
    item_type: isService ? "service" : "product",
    name_ar: isService ? "صيانة منزلية لمدة ساعة" : "منتج تجريبي",
    name_en: isService ? "One-hour home maintenance" : "QA product",
    description_ar: isService
      ? "خدمة قابلة للحجز لاختبار رحلة العميل ومركز مقدم الخدمة"
      : "منتج مخصص لاختبار متجر البائع",
    base_price: isService ? 149 : 79,
    currency_code: "SAR",
    duration_minutes: isService ? 60 : null,
    track_inventory: !isService,
    stock_quantity: isService ? null : 50,
    is_available: true,
    is_featured: true,
    qa_batch_id: QA_BATCH,
  };

  const { data: existingItem, error: itemLookupError } = await client
    .from("mkt_store_items")
    .select("id")
    .eq("storefront_id", storefrontId)
    .eq("qa_batch_id", QA_BATCH)
    .is("deleted_at", null)
    .maybeSingle();
  if (itemLookupError) throw itemLookupError;

  if (existingItem?.id) {
    const { error } = await client
      .from("mkt_store_items")
      .update(itemPayload)
      .eq("id", existingItem.id);
    if (error) throw error;
  } else {
    const { error } = await client.from("mkt_store_items").insert(itemPayload);
    if (error) throw error;
  }

  if (isService) {
    const { error } = await client.from("mkt_service_settings").upsert(
      {
        storefront_id: storefrontId,
        category_code: "maintenance",
        confirmation_mode: "instant",
        service_modes: ["at_provider", "at_customer"],
        visit_fee: 25,
        accepts_bookings: true,
      },
      { onConflict: "storefront_id" },
    );
    if (error) throw error;
  }
}

async function main() {
  const existingUsers = await listUsers();
  const accounts = [];
  for (const definition of definitions) {
    accounts.push(await ensureUser(definition, existingUsers));
  }

  for (const account of accounts.filter((row) =>
    ["retail", "services"].includes(row.definition.kind),
  )) {
    await ensureStore(account);
  }

  const admin = accounts.find((row) => row.definition.kind === "admin");
  const { error: adminError } = await client
    .from("mkt_platform_admins")
    .upsert(
      {
        user_id: admin.userId,
        platform_role: "platform_admin",
        granted_reason: QA_BATCH,
        created_by: admin.userId,
      },
      { onConflict: "user_id" },
    );
  if (adminError) throw adminError;

  process.stdout.write(
    `${JSON.stringify(
      {
        warning: "Store this output securely. Passwords are generated and reset on every run.",
        storesPublished: publishStores,
        accounts: accounts.map(({ definition, email, password: accountPassword }) => ({
          type: definition.kind,
          email,
          password: accountPassword,
        })),
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
