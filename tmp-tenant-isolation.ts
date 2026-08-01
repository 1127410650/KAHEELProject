/**
 * Tenant isolation acceptance test.
 * Creates TEST-TENANT-A / TEST-TENANT-B with one user each, seeds a project per
 * tenant, then verifies through real user sessions (RLS applies) that neither
 * side can read, write, or reach the other's rows. Cleans up afterwards.
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL!;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const results: { name: string; pass: boolean; detail?: string }[] = [];
function check(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function makeUser(email: string) {
  const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = existing?.users.find((u) => u.email === email);
  if (found) await admin.auth.admin.deleteUser(found.id);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "IsolationTest#2026",
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!.id;
}

async function userClient(email: string) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: "IsolationTest#2026" });
  if (error) throw error;
  return c;
}

async function main() {
  const emailA = "isolation-a@tahqaq.test";
  const emailB = "isolation-b@tahqaq.test";

  // --- cleanup from earlier runs
  await admin.from("tenants").delete().eq("is_test", true);

  const uidA = await makeUser(emailA);
  const uidB = await makeUser(emailB);

  const { data: tenants, error: tErr } = await admin
    .from("tenants")
    .insert([
      { name_ar: "كيان اختبار أ", name_en: "TEST-TENANT-A", is_test: true },
      { name_ar: "كيان اختبار ب", name_en: "TEST-TENANT-B", is_test: true },
    ])
    .select("id, name_en");
  if (tErr) throw tErr;
  const tA = tenants!.find((x) => x.name_en === "TEST-TENANT-A")!.id;
  const tB = tenants!.find((x) => x.name_en === "TEST-TENANT-B")!.id;

  // Profiles are created by the signup trigger; make sure both exist.
  for (const uid of [uidA, uidB]) {
    const { data } = await admin.from("profiles").select("user_id").eq("user_id", uid).maybeSingle();
    if (!data) await admin.from("profiles").insert({ user_id: uid, full_name: "Isolation Test" });
  }

  await admin.from("tenant_memberships").insert([
    { tenant_id: tA, user_id: uidA, role: "accountant", status: "active" },
    { tenant_id: tB, user_id: uidB, role: "accountant", status: "active" },
  ]);
  await admin.from("profiles").update({ active_tenant_id: tA }).eq("user_id", uidA);
  await admin.from("profiles").update({ active_tenant_id: tB }).eq("user_id", uidB);

  // Global app role, so module policies allow normal accountant work.
  await admin.from("user_roles").upsert(
    [
      { user_id: uidA, role: "accountant" },
      { user_id: uidB, role: "accountant" },
    ],
    { onConflict: "user_id,role" },
  );

  const { data: sups, error: sErr } = await admin
    .from("supervisors")
    .insert([
      { name_ar: "مشرف كيان أ", national_id: "1000000001", phone: "0500000001", tenant_id: tA },
      { name_ar: "مشرف كيان ب", national_id: "1000000002", phone: "0500000002", tenant_id: tB },
    ])
    .select("id, tenant_id");
  if (sErr) throw sErr;
  const sA = sups!.find((x) => x.tenant_id === tA)!.id;
  const sB = sups!.find((x) => x.tenant_id === tB)!.id;

  const { data: projs, error: pErr } = await admin
    .from("projects")
    .insert([
      { name_ar: "مشروع كيان أ", code: "ISO-A", supervisor_id: sA, tenant_id: tA },
      { name_ar: "مشروع كيان ب", code: "ISO-B", supervisor_id: sB, tenant_id: tB },
    ])
    .select("id, code, tenant_id");
  if (pErr) throw pErr;
  const pA = projs!.find((x) => x.code === "ISO-A")!.id;
  const pB = projs!.find((x) => x.code === "ISO-B")!.id;

  const ca = await userClient(emailA);
  const cb = await userClient(emailB);

  // 1. Each side sees only its own projects.
  const { data: seenA } = await ca.from("projects").select("id, code");
  const { data: seenB } = await cb.from("projects").select("id, code");
  check(
    "A sees only tenant A projects",
    !!seenA && seenA.length === 1 && seenA[0]!.code === "ISO-A",
    `count=${seenA?.length}`,
  );
  check(
    "B sees only tenant B projects",
    !!seenB && seenB.length === 1 && seenB[0]!.code === "ISO-B",
    `count=${seenB?.length}`,
  );

  // 2. Direct fetch by known foreign id returns nothing.
  const { data: crossRead } = await ca.from("projects").select("id").eq("id", pB);
  check("A cannot read B project by id", (crossRead?.length ?? 0) === 0);

  // 3. Cross-tenant update / delete are no-ops.
  const { data: upd } = await ca.from("projects").update({ name_ar: "hacked" }).eq("id", pB).select("id");
  check("A cannot update B project", (upd?.length ?? 0) === 0);
  const { data: del } = await ca.from("projects").delete().eq("id", pB).select("id");
  check("A cannot delete B project", (del?.length ?? 0) === 0);
  const { data: stillThere } = await admin.from("projects").select("name_ar").eq("id", pB).single();
  check("B project untouched", stillThere?.name_ar === "مشروع كيان ب", stillThere?.name_ar);

  // 4. Insert forged into the other tenant is rejected.
  const forged = await ca.from("projects").insert({ name_ar: "forged", code: "ISO-FORGE", supervisor_id: sB, tenant_id: tB });
  check("A cannot insert into tenant B", !!forged.error, forged.error?.message ?? "no error");

  // 5. Insert without tenant_id lands in the caller's own tenant.
  const own = await ca.from("projects").insert({ name_ar: "مشروع تلقائي", code: "ISO-AUTO", supervisor_id: sA }).select("id, tenant_id").single();
  check("A insert auto-assigns tenant A", own.data?.tenant_id === tA, own.error?.message ?? "");

  // 6. Child rows cannot be attached to a foreign parent.
  const child = await ca
    .from("property_deeds")
    .insert({ project_id: pB, deed_no: "ISO-1" })
    .select("id");
  check("A cannot add a record under B project", !!child.error, child.error?.message ?? "no error");

  // 7. tenant_id of an own row is immutable.
  if (own.data?.id) {
    const move = await ca.from("projects").update({ tenant_id: tB }).eq("id", own.data.id).select("id");
    check(
      "A cannot move its own project to tenant B",
      !!move.error || (move.data?.length ?? 0) === 0,
      move.error?.message ?? "blocked by policy",
    );
  }

  // 8. Storage: signed URL for a foreign project's file is refused.
  const foreignPath = `projects/${pB}/docs/secret.pdf`;
  await admin.storage.from("attachments").upload(foreignPath, new Blob(["secret"]), { upsert: true });
  const signed = await ca.storage.from("attachments").createSignedUrl(foreignPath, 60);
  check("A cannot sign a URL for B file", !!signed.error, signed.error?.message ?? "signed!");
  const listed = await ca.storage.from("attachments").list(`projects/${pB}/docs`);
  check("A cannot list B files", (listed.data?.length ?? 0) === 0, `count=${listed.data?.length}`);

  // 9. Switching workspaces is refused for non-members.
  const badSwitch = await ca.rpc("set_active_tenant", { _tenant_id: tB });
  check("A cannot switch into tenant B", !!badSwitch.error, badSwitch.error?.message ?? "switched!");

  // 10. my_tenants only lists own memberships.
  const mine = await ca.rpc("my_tenants");
  check(
    "my_tenants returns only own workspace",
    (mine.data as { tenant_id: string }[] | null)?.every((r) => r.tenant_id === tA) === true &&
      (mine.data as unknown[] | null)?.length === 1,
  );

  // 11. Production data stays intact and invisible to the test tenants.
  const { count: prodProjects } = await admin
    .from("projects")
    .select("id", { count: "exact", head: true })
    .not("code", "like", "ISO-%");
  check("production projects still present", (prodProjects ?? 0) > 0, `count=${prodProjects}`);

  // --- cleanup
  await admin.storage.from("attachments").remove([foreignPath]);
  await admin.from("projects").delete().like("code", "ISO-%");
  await admin.from("supervisors").delete().in("id", [sA, sB]);
  await admin.from("tenants").delete().in("id", [tA, tB]);
  await admin.auth.admin.deleteUser(uidA);
  await admin.auth.admin.deleteUser(uidB);

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error("test crashed:", e);
  process.exit(1);
});
