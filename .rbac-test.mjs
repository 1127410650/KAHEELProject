import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const PUB = process.env.SUPABASE_PUBLISHABLE_KEY;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;

const fetchWithKey = (key) => (input, init) => {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
  if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
  headers.set("apikey", key);
  return fetch(input, { ...init, headers });
};

const admin = createClient(URL, SVC, {
  global: { fetch: fetchWithKey(SVC) },
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? " :: " + detail : ""}`);
};

async function userClient(email, password) {
  const c = createClient(URL, PUB, {
    global: { fetch: fetchWithKey(PUB) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  const authed = createClient(URL, PUB, {
    global: {
      fetch: fetchWithKey(PUB),
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return authed;
}

const PW = "Tahqaq!Test-2026";
const stamp = Date.now();
const created = { tenants: [], users: [] };

async function mkTenant(name) {
  const { data, error } = await admin
    .from("tenants")
    .insert({ name_ar: name, name_en: name, status: "active" })
    .select("id")
    .single();
  if (error) throw new Error(`tenant ${name}: ${error.message}`);
  created.tenants.push(data.id);
  return data.id;
}

async function mkUser(email) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PW,
    email_confirm: true,
    user_metadata: { full_name: email },
  });
  if (error) throw new Error(`user ${email}: ${error.message}`);
  const id = data.user.id;
  created.users.push(id);
  await admin
    .from("profiles")
    .upsert(
      { user_id: id, full_name: email, email, is_active: true, must_change_password: false },
      { onConflict: "user_id" },
    );
  return id;
}

async function member(tenant, user, role) {
  const { error } = await admin
    .from("tenant_memberships")
    .upsert({ tenant_id: tenant, user_id: user, role, status: "active" }, { onConflict: "tenant_id,user_id" });
  if (error) throw new Error(`membership: ${error.message}`);
}

async function grantRole(tenant, user, role) {
  const { error } = await admin.from("user_roles").insert({ tenant_id: tenant, user_id: user, role });
  return error?.message ?? null;
}

async function grantPerm(tenant, user, permission) {
  const { error } = await admin
    .from("user_permissions")
    .insert({ tenant_id: tenant, user_id: user, permission });
  return error?.message ?? null;
}

async function cleanup() {
  for (const t of created.tenants) {
    await admin.from("user_roles").delete().eq("tenant_id", t);
    await admin.from("user_permissions").delete().eq("tenant_id", t);
    await admin.from("project_members").delete().eq("tenant_id", t);
    await admin.from("custody_transactions").delete().eq("tenant_id", t);
    await admin.from("invoices").delete().eq("tenant_id", t);
    await admin.from("projects").delete().eq("tenant_id", t);
    await admin.from("supervisors").delete().eq("tenant_id", t);
    await admin.from("tenant_memberships").delete().eq("tenant_id", t);
    await admin.from("app_settings").delete().eq("tenant_id", t);
    await admin.from("audit_log").delete().eq("tenant_id", t);
    await admin.from("notifications").delete().eq("tenant_id", t);
    await admin.from("tenants").delete().eq("id", t);
  }
  for (const u of created.users) {
    await admin.from("user_roles").delete().eq("user_id", u);
    await admin.from("user_permissions").delete().eq("user_id", u);
    await admin.from("tenant_memberships").delete().eq("user_id", u);
    await admin.from("profiles").delete().eq("user_id", u);
    await admin.auth.admin.deleteUser(u).catch(() => {});
  }
}

async function main() {
  const A = await mkTenant(`__test_A_${stamp}`);
  const B = await mkTenant(`__test_B_${stamp}`);
  const e1 = `iso_u1_${stamp}@example.test`;
  const e2 = `iso_u2_${stamp}@example.test`;
  const u1 = await mkUser(e1); // owner in A, viewer in B
  const u2 = await mkUser(e2); // accountant in A, supervisor in B

  await member(A, u1, "owner");
  await member(B, u1, "viewer");
  await member(A, u2, "accountant");
  await member(B, u2, "supervisor");

  check("1) owner in A + viewer in B set up", true, `A=${A.slice(0, 8)} B=${B.slice(0, 8)}`);

  // roles are per tenant
  check("roles: accountant granted in A", (await grantRole(A, u2, "accountant")) === null);
  check("roles: supervisor granted in B", (await grantRole(B, u2, "supervisor")) === null);
  check("roles: owner user has accountant role in A", (await grantRole(A, u1, "accountant")) === null);
  // grant without membership must be blocked
  const u3 = await mkUser(`iso_u3_${stamp}@example.test`);
  const blocked = await grantRole(A, u3, "accountant");
  check("9a) role for non-member rejected by DB", !!blocked, blocked ?? "accepted!");

  // permissions per tenant
  check("perm custody.view_own in B for u2", (await grantPerm(B, u2, "custody.view_own")) === null);
  check("perm invoices.view in A for u2", (await grantPerm(A, u2, "invoices.view")) === null);

  // seed data in both tenants
  const mkProject = async (tenant, code) => {
    const { data: sup, error: se } = await admin
      .from("supervisors")
      .insert({ tenant_id: tenant, name_ar: `مشرف ${code}`, id_number: `${stamp}`.slice(-9) + code, phone: "0500000000" })
      .select("id")
      .single();
    if (se) throw new Error(`supervisor: ${se.message}`);
    const { data: pr, error: pe } = await admin
      .from("projects")
      .insert({ tenant_id: tenant, name_ar: `مشروع ${code}`, code: `T-${code}-${stamp}`.slice(0, 20), supervisor_id: sup.id })
      .select("id")
      .single();
    if (pe) throw new Error(`project: ${pe.message}`);
    const { error: ce } = await admin.from("custody_transactions").insert({
      tenant_id: tenant,
      supervisor_id: sup.id,
      project_id: pr.id,
      txn_type: "addition",
      amount: 1000,
      txn_date: new Date().toISOString().slice(0, 10),
      status: "approved",
    });
    if (ce) console.log("custody seed note:", ce.message);
    return { sup: sup.id, project: pr.id };
  };
  const seedA = await mkProject(A, "AA");
  const seedB = await mkProject(B, "BB");

  // ---- u2: accountant in A, supervisor in B
  const c2 = await userClient(e2, PW);
  await c2.rpc("set_active_tenant", { _tenant_id: A });
  const inA = {
    accountant: (await c2.rpc("is_accountant")).data,
    tenant: (await c2.rpc("current_tenant_id")).data,
    projects: (await c2.from("projects").select("id")).data?.length ?? 0,
    custody: (await c2.from("custody_transactions").select("id")).data?.length ?? 0,
    perm_invoices: (await c2.rpc("has_perm", { _perm: "invoices.view" })).data,
  };
  check("2/3) u2 is accountant in A", inA.accountant === true, JSON.stringify(inA));
  check("A data visible to accountant", inA.projects >= 1 && inA.custody >= 1, JSON.stringify(inA));

  await c2.rpc("set_active_tenant", { _tenant_id: B });
  const inB = {
    accountant: (await c2.rpc("is_accountant")).data,
    staff: (await c2.rpc("is_staff")).data,
    tenant: (await c2.rpc("current_tenant_id")).data,
    projects: (await c2.from("projects").select("id, tenant_id")).data ?? [],
    custody: (await c2.from("custody_transactions").select("id")).data?.length ?? 0,
    invoices: (await c2.from("invoices").select("id")).data?.length ?? 0,
    perm_invoices_view: (await c2.rpc("has_perm", { _perm: "invoices.view" })).data,
    perm_custody_own: (await c2.rpc("has_perm", { _perm: "custody.view_own" })).data,
    role_accountant_in_B: (await c2.rpc("has_role_in_tenant", { _user_id: u2, _tenant_id: B, _role: "accountant" })).data,
  };
  check("3) accountant powers do NOT apply in B", inB.accountant === false && inB.role_accountant_in_B === false, JSON.stringify(inB));
  check("3b) A rows invisible from B", !inB.projects.some((p) => p.tenant_id === A), JSON.stringify(inB.projects.map((p) => p.tenant_id?.slice(0, 8))));
  check("4) supervisor sees no custody/invoices in B without explicit perm", inB.custody === 0 && inB.invoices === 0, `custody=${inB.custody} invoices=${inB.invoices}`);
  check("4b) invoices.view granted only in A is false in B", inB.perm_invoices_view === false, String(inB.perm_invoices_view));
  check("4c) custody.view_own granted in B is true in B", inB.perm_custody_own === true, String(inB.perm_custody_own));

  // 5) revoking a permission in B leaves A untouched
  await admin.from("user_permissions").delete().eq("tenant_id", B).eq("user_id", u2).eq("permission", "custody.view_own");
  const afterRevokeB = (await c2.rpc("has_perm", { _perm: "custody.view_own" })).data;
  await c2.rpc("set_active_tenant", { _tenant_id: A });
  const stillA = (await c2.rpc("has_perm", { _perm: "invoices.view" })).data;
  check("5) revoke in B does not affect A", afterRevokeB === false && stillA === true, `B=${afterRevokeB} A=${stillA}`);

  // 9) manual tenant_id / membership tampering
  const tamper1 = await c2.from("user_roles").insert({ tenant_id: B, user_id: u2, role: "accountant" });
  const tamper2 = await c2.from("user_roles").update({ tenant_id: B }).eq("user_id", u2).eq("tenant_id", A);
  const tamper3 = await c2.from("tenant_memberships").update({ role: "owner" }).eq("user_id", u2).eq("tenant_id", B);
  const tamper4 = await c2.from("user_permissions").insert({ tenant_id: B, user_id: u2, permission: "invoices.view" });
  await c2.rpc("set_active_tenant", { _tenant_id: B });
  const escalated = (await c2.rpc("is_accountant")).data;
  check(
    "9) manual tenant_id / membership tampering grants nothing",
    escalated === false,
    `insertRole=${tamper1.error?.code ?? "ok"} moveRole=${tamper2.error?.code ?? "ok"} membership=${tamper3.error?.code ?? "ok"} insertPerm=${tamper4.error?.code ?? "ok"} isAccountant=${escalated}`,
  );

  // 1) owner in A / viewer in B
  const c1 = await userClient(e1, PW);
  await c1.rpc("set_active_tenant", { _tenant_id: A });
  const o1 = { acc: (await c1.rpc("is_accountant")).data, projects: (await c1.from("projects").select("id")).data?.length ?? 0 };
  await c1.rpc("set_active_tenant", { _tenant_id: B });
  const o2 = {
    acc: (await c1.rpc("is_accountant")).data,
    projects: (await c1.from("projects").select("id, tenant_id")).data ?? [],
    roleRows: (await c1.from("user_roles").select("tenant_id")).data ?? [],
  };
  check("1a) owner in A has admin power in A only", o1.acc === true && o2.acc === false, `A=${o1.acc} B=${o2.acc}`);
  check("1b) viewer in B sees no A rows", !o2.projects.some((p) => p.tenant_id === A));
  check("8) role rows readable are B-scoped only after switch", o2.roleRows.every((r) => r.tenant_id === B), JSON.stringify(o2.roleRows.map((r) => r.tenant_id?.slice(0, 8))));

  // 7/8) switching back restores A immediately, no stale grants
  await c1.rpc("set_active_tenant", { _tenant_id: A });
  const backA = { acc: (await c1.rpc("is_accountant")).data, tenant: (await c1.rpc("current_tenant_id")).data };
  const freshAfterReload = await userClient(e1, PW); // simulates page refresh (new session/client)
  const reload = {
    tenant: (await freshAfterReload.rpc("current_tenant_id")).data,
    acc: (await freshAfterReload.rpc("is_accountant")).data,
  };
  check("7) switching workspace flips data/permissions immediately", backA.acc === true && backA.tenant === A);
  check("8b) refresh keeps the new workspace, not the previous one", reload.tenant === A && reload.acc === true, JSON.stringify(reload));

  // 6) ending membership cuts that tenant only
  await admin.from("tenant_memberships").update({ status: "inactive" }).eq("tenant_id", B).eq("user_id", u2);
  const c2b = await userClient(e2, PW);
  const endB = await c2b.rpc("set_active_tenant", { _tenant_id: B });
  const bGrants = await admin.from("user_roles").select("id").eq("tenant_id", B).eq("user_id", u2);
  await c2b.rpc("set_active_tenant", { _tenant_id: A });
  const aStill = (await c2b.rpc("is_accountant")).data;
  check(
    "6) ending membership in B revokes B only",
    (bGrants.data?.length ?? 1) === 0 && aStill === true,
    `switchToB=${endB.error ? "rejected" : "allowed"} bRoleRows=${bGrants.data?.length} accountantInA=${aStill}`,
  );

  // 11) orphan grants + 10) no global-role function
  const { data: audit } = await admin.rpc("current_tenant_id").select?.() ?? { data: null };
  const orphans = await admin.rpc("has_role_in_tenant", { _user_id: u2, _tenant_id: B, _role: "accountant" });
  check("10/11) helper reports no B role for u2 after revoke", orphans.data === false, String(orphans.data));

  await cleanup();
  const failed = results.filter((r) => !r.pass);
  console.log(`\nTOTAL ${results.length} | PASS ${results.length - failed.length} | FAIL ${failed.length}`);
  if (failed.length) console.log("FAILED:", failed.map((f) => f.name).join(" | "));
}

main().catch(async (e) => {
  console.error("ERROR:", e.message);
  await cleanup();
  process.exit(1);
});
