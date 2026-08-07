const EXPECTED_PROJECT_REF = process.env.RLS_TEST_EXPECTED_PROJECT_REF?.trim() || "fdmovlxyqebtgzhsroac";

const REQUIRED_ENV = [
  "RLS_TEST_SUPABASE_URL",
  "RLS_TEST_PUBLISHABLE_KEY",
  "RLS_TEST_USER_A_ACCESS_TOKEN",
  "RLS_TEST_USER_B_ACCESS_TOKEN",
  "RLS_TEST_TENANT_A_ID",
  "RLS_TEST_TENANT_B_ID",
  "RLS_TEST_PROJECT_A_ID",
  "RLS_TEST_PROJECT_B_ID",
  "RLS_TEST_ATTACHMENT_A_ID",
  "RLS_TEST_ATTACHMENT_B_ID",
  "RLS_TEST_STORAGE_BUCKET",
  "RLS_TEST_STORAGE_A_PATH",
  "RLS_TEST_STORAGE_B_PATH",
];

function fail(message) {
  console.error(`Adversarial RLS test failed: ${message}`);
  process.exit(1);
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`missing required environment variable ${name}`);
  if (/\r|\n/.test(value)) fail(`${name} contains a forbidden line break`);
  return value;
}

for (const name of REQUIRED_ENV) requiredEnv(name);

const supabaseUrl = new URL(requiredEnv("RLS_TEST_SUPABASE_URL"));
if (supabaseUrl.protocol !== "https:") fail("Supabase URL must use HTTPS");
if (
  supabaseUrl.hostname.endsWith(".supabase.co") &&
  supabaseUrl.hostname.split(".")[0] !== EXPECTED_PROJECT_REF
) {
  fail(`Supabase URL does not target the reviewed project reference ${EXPECTED_PROJECT_REF}`);
}
if (
  !supabaseUrl.hostname.endsWith(".supabase.co") &&
  process.env.RLS_TEST_ALLOW_CUSTOM_DOMAIN !== "1"
) {
  fail("custom Supabase domains require RLS_TEST_ALLOW_CUSTOM_DOMAIN=1");
}

const publishableKey = requiredEnv("RLS_TEST_PUBLISHABLE_KEY");
if (/service_role|sb_secret_/i.test(publishableKey)) {
  fail("service-role or secret keys are forbidden in adversarial client tests");
}

const actorA = {
  label: "A",
  token: requiredEnv("RLS_TEST_USER_A_ACCESS_TOKEN"),
  tenantId: requiredEnv("RLS_TEST_TENANT_A_ID"),
  projectId: requiredEnv("RLS_TEST_PROJECT_A_ID"),
  attachmentId: requiredEnv("RLS_TEST_ATTACHMENT_A_ID"),
  storagePath: requiredEnv("RLS_TEST_STORAGE_A_PATH"),
};
const actorB = {
  label: "B",
  token: requiredEnv("RLS_TEST_USER_B_ACCESS_TOKEN"),
  tenantId: requiredEnv("RLS_TEST_TENANT_B_ID"),
  projectId: requiredEnv("RLS_TEST_PROJECT_B_ID"),
  attachmentId: requiredEnv("RLS_TEST_ATTACHMENT_B_ID"),
  storagePath: requiredEnv("RLS_TEST_STORAGE_B_PATH"),
};
const storageBucket = requiredEnv("RLS_TEST_STORAGE_BUCKET");

if (actorA.tenantId === actorB.tenantId) fail("QA actors must belong to different tenants");
if (actorA.projectId === actorB.projectId) fail("QA actors must use different projects");
if (actorA.attachmentId === actorB.attachmentId) fail("QA actors must use different attachments");
if (actorA.storagePath === actorB.storagePath) fail("QA actors must use different storage objects");

function decodeJwtPayload(token, label) {
  const parts = token.split(".");
  if (parts.length !== 3) fail(`actor ${label} access token is not a JWT`);
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    fail(`actor ${label} access token payload is invalid`);
  }
}

for (const actor of [actorA, actorB]) {
  const payload = decodeJwtPayload(actor.token, actor.label);
  if (typeof payload.sub !== "string" || !payload.sub) fail(`actor ${actor.label} token has no subject`);
  if (payload.role && payload.role !== "authenticated") {
    fail(`actor ${actor.label} token role must be authenticated`);
  }
  if (typeof payload.exp === "number" && payload.exp <= Math.floor(Date.now() / 1000)) {
    fail(`actor ${actor.label} access token is expired`);
  }
  actor.userId = payload.sub;
}
if (actorA.userId === actorB.userId) fail("QA actors must be two different authenticated users");

function authHeaders(actor, extra = {}) {
  return {
    apikey: publishableKey,
    authorization: `Bearer ${actor.token}`,
    accept: "application/json",
    ...extra,
  };
}

async function selectRows(actor, table, filters, select) {
  const url = new URL(`/rest/v1/${table}`, supabaseUrl);
  url.searchParams.set("select", select);
  url.searchParams.set("limit", "2");
  for (const [column, value] of Object.entries(filters)) {
    url.searchParams.set(column, `eq.${value}`);
  }

  const response = await fetch(url, {
    method: "GET",
    headers: authHeaders(actor),
    redirect: "error",
    cache: "no-store",
  });

  if (response.status === 401) fail(`actor ${actor.label} authentication was rejected while reading ${table}`);
  if (response.status === 403) return { denied: true, rows: [] };
  if (!response.ok) fail(`unexpected HTTP ${response.status} while actor ${actor.label} read ${table}`);

  const rows = await response.json();
  if (!Array.isArray(rows)) fail(`${table} returned a non-array response`);
  return { denied: false, rows };
}

async function expectOwnRow(actor, table, id, select) {
  const result = await selectRows(actor, table, { id }, select);
  if (result.denied || result.rows.length !== 1) {
    fail(`actor ${actor.label} could not read its reviewed ${table} row`);
  }
  const row = result.rows[0];
  if (row.id !== id) fail(`${table} returned the wrong reviewed row for actor ${actor.label}`);
  if ("tenant_id" in row && row.tenant_id !== actor.tenantId) {
    fail(`${table} own-row tenant mismatch for actor ${actor.label}`);
  }
}

async function expectForeignRowHidden(actor, table, id, select) {
  const result = await selectRows(actor, table, { id }, select);
  if (!result.denied && result.rows.length !== 0) {
    fail(`cross-tenant ${table} read exposed ${result.rows.length} row(s) to actor ${actor.label}`);
  }
}

async function expectForeignTenantHidden(actor, table, foreignTenantId) {
  const result = await selectRows(actor, table, { tenant_id: foreignTenantId }, "id,tenant_id");
  if (!result.denied && result.rows.length !== 0) {
    fail(`tenant-filter tampering exposed ${table} rows to actor ${actor.label}`);
  }
}

function objectUrl(path) {
  const segments = [storageBucket, ...path.split("/")].map((segment) => encodeURIComponent(segment));
  return new URL(`/storage/v1/object/authenticated/${segments.join("/")}`, supabaseUrl);
}

async function fetchStorage(actor, path) {
  return fetch(objectUrl(path), {
    method: "GET",
    headers: authHeaders(actor, { range: "bytes=0-0" }),
    redirect: "error",
    cache: "no-store",
  });
}

async function expectOwnStorage(actor) {
  const response = await fetchStorage(actor, actor.storagePath);
  if (!response.ok) {
    fail(`actor ${actor.label} could not read its reviewed storage object (HTTP ${response.status})`);
  }
  await response.body?.cancel();
}

async function expectForeignStorageHidden(actor, foreignPath) {
  const response = await fetchStorage(actor, foreignPath);
  if (response.ok) {
    await response.body?.cancel();
    fail(`cross-tenant storage object was readable by actor ${actor.label}`);
  }
  if (![400, 401, 403, 404].includes(response.status)) {
    fail(`unexpected HTTP ${response.status} for denied storage read by actor ${actor.label}`);
  }
}

console.log("Running read-only adversarial RLS checks with two isolated QA identities...");

for (const [actor, foreign] of [
  [actorA, actorB],
  [actorB, actorA],
]) {
  await expectOwnRow(actor, "projects", actor.projectId, "id,tenant_id");
  await expectForeignRowHidden(actor, "projects", foreign.projectId, "id,tenant_id");
  await expectForeignTenantHidden(actor, "projects", foreign.tenantId);

  await expectOwnRow(actor, "attachments", actor.attachmentId, "id,tenant_id,project_id,storage_path");
  await expectForeignRowHidden(
    actor,
    "attachments",
    foreign.attachmentId,
    "id,tenant_id,project_id,storage_path",
  );
  await expectForeignTenantHidden(actor, "attachments", foreign.tenantId);

  await expectOwnStorage(actor);
  await expectForeignStorageHidden(actor, foreign.storagePath);
}

console.log("Adversarial RLS checks passed: project, attachment, tenant-filter, and storage reads stayed isolated in both directions.");
