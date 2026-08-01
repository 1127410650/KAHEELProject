import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!, pub = process.env.SUPABASE_PUBLISHABLE_KEY!;
const admin = createClient(url, svc, { auth: { persistSession: false } });
const pass = "Test#" + Math.random().toString(36).slice(2, 10);
const R: string[] = []; let ok = 0, fail = 0;
const check = (n: string, c: boolean, extra = "") => { c ? ok++ : fail++; R.push(`${c ? "PASS" : "FAIL"} ${n} ${extra}`); };

async function user(email: string) {
  const { data: l } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const ex = l?.users.find((u) => u.email === email);
  if (ex) { await admin.auth.admin.updateUserById(ex.id, { password: pass, email_confirm: true }); return ex.id; }
  const { data, error } = await admin.auth.admin.createUser({ email, password: pass, email_confirm: true });
  if (error) throw error; return data.user!.id;
}
async function tenant(name: string) {
  const { data, error } = await admin.from("tenants").insert({ name_ar: name, name_en: name, status: "active" }).select("id").single();
  if (error) throw error; return data.id as string;
}
async function client(email: string) {
  const c = createClient(url, pub, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: pass });
  if (error) throw new Error(email + ": " + error.message);
  return c;
}

const ta = await tenant("TEST-TENANT-A"), tb = await tenant("TEST-TENANT-B");
const ua = await user("isolation-a@tahqaq.test"), ub = await user("isolation-b@tahqaq.test");
for (const [u, t, role] of [[ua, ta, "owner"], [ub, tb, "accountant"]] as const) {
  await admin.from("tenant_memberships").upsert({ tenant_id: t, user_id: u, role, status: "active", created_by: u }, { onConflict: "tenant_id,user_id" });
  await admin.from("profiles").upsert({ user_id: u, full_name: "ISO " + role, active_tenant_id: t, locale: "ar", is_active: true }, { onConflict: "user_id" });
  await admin.from("user_roles").upsert({ user_id: u, role: "accountant" }, { onConflict: "user_id,role" });
}
const mk = async (t: string, code: string) => {
  const { data: p, error } = await admin.from("projects").insert({ tenant_id: t, name: "ISO " + code, code, status: "active" }).select("id").single();
  if (error) throw error;
  const { data: r } = await admin.from("requests").insert({ tenant_id: t, project_id: p!.id, title: "ISO req " + code, request_type: "purchase", status: "submitted" }).select("id").single();
  const { data: s } = await admin.from("suppliers").insert({ tenant_id: t, name: "ISO sup " + code }).select("id").single();
  const { data: i } = await admin.from("invoices").insert({ tenant_id: t, project_id: p!.id, supplier_id: s?.id, invoice_number: "ISO-" + code, invoice_date: "2026-01-01", total_amount: 100 }).select("id").single();
  const path = `projects/${p!.id}/${crypto.randomUUID()}/iso.txt`;
  await admin.storage.from("attachments").upload(path, new Blob(["iso"]), { contentType: "text/plain" });
  return { pid: p!.id, rid: r?.id, sid: s?.id, iid: i?.id, path };
};
const A = await mk(ta, "ISOA"), B = await mk(tb, "ISOB");
const ca = await client("isolation-a@tahqaq.test"), cb = await client("isolation-b@tahqaq.test");

// 1. scoped lists
for (const [n, c, own, other] of [["A", ca, A, B], ["B", cb, B, A]] as const) {
  const { data: pr } = await c.from("projects").select("id");
  check(`projects-scope-${n}`, !!pr && pr.some(x => x.id === own.pid) && !pr.some(x => x.id === other.pid), JSON.stringify(pr?.length));
  const { data: rq } = await c.from("requests").select("id");
  check(`requests-scope-${n}`, !rq?.some(x => x.id === other.rid));
  const { data: inv } = await c.from("invoices").select("id");
  check(`invoices-scope-${n}`, !!inv && inv.some(x => x.id === own.iid) && !inv.some(x => x.id === other.iid));
  const { data: sp } = await c.from("suppliers").select("id");
  check(`suppliers-scope-${n}`, !sp?.some(x => x.id === other.sid));
  // direct id probe
  const { data: dp } = await c.from("projects").select("id").eq("id", other.pid).maybeSingle();
  check(`direct-project-id-${n}`, !dp);
  const { data: di } = await c.from("invoices").select("id").eq("id", other.iid!).maybeSingle();
  check(`direct-invoice-id-${n}`, !di);
  const { data: dr } = await c.from("requests").select("id").eq("id", other.rid!).maybeSingle();
  check(`direct-request-id-${n}`, !dr);
  // storage signed url of the other tenant
  const su = await c.storage.from("attachments").createSignedUrl(other.path, 60);
  check(`signed-url-denied-${n}`, !su.data?.signedUrl, su.error?.message ?? "");
  const mine = await c.storage.from("attachments").createSignedUrl(own.path, 60);
  check(`signed-url-own-ok-${n}`, !!mine.data?.signedUrl, mine.error?.message ?? "");
  // spoof tenant_id on insert
  const spoof = await c.from("projects").insert({ tenant_id: other.pid ? (n === "A" ? tb : ta) : null, name: "spoof", code: "SPOOF" + n, status: "active" }).select("id");
  check(`insert-spoof-tenant-blocked-${n}`, !!spoof.error, spoof.error?.code ?? "");
  // update tenant_id of own project
  const imm = await c.from("projects").update({ tenant_id: n === "A" ? tb : ta }).eq("id", own.pid).select("id");
  check(`tenant_id-immutable-${n}`, !!imm.error || (imm.data?.length ?? 0) === 0, imm.error?.message?.slice(0, 40) ?? "");
  // my_tenants only own
  const { data: mt } = await c.rpc("my_tenants");
  check(`my_tenants-single-${n}`, (mt as any[])?.length === 1);
  // switching to a tenant you are not a member of
  const sw = await c.rpc("set_active_tenant", { _tenant_id: n === "A" ? tb : ta });
  check(`set_active_tenant-blocked-${n}`, !!sw.error, sw.error?.message?.slice(0, 40) ?? "");
}
// dual membership + switch
await admin.from("tenant_memberships").upsert({ tenant_id: tb, user_id: ua, role: "viewer", status: "active", created_by: ua }, { onConflict: "tenant_id,user_id" });
const cd = await client("isolation-a@tahqaq.test");
const { data: mt2 } = await cd.rpc("my_tenants");
check("dual-membership-2-tenants", (mt2 as any[])?.length === 2);
let sw = await cd.rpc("set_active_tenant", { _tenant_id: tb });
check("switch-allowed-when-member", !sw.error, sw.error?.message ?? "");
const c2 = await client("isolation-a@tahqaq.test");
const { data: after } = await c2.from("projects").select("id,code");
check("after-switch-only-new-tenant", !!after && after.some(x => x.id === B.pid) && !after.some(x => x.id === A.pid), JSON.stringify(after));
const suOld = await c2.storage.from("attachments").createSignedUrl(A.path, 60);
check("after-switch-old-file-denied", !suOld.data?.signedUrl);
sw = await cd.rpc("set_active_tenant", { _tenant_id: ta });
const c3 = await client("isolation-a@tahqaq.test");
const { data: back } = await c3.from("projects").select("id");
check("switch-back-only-A", !!back && back.some(x => x.id === A.pid) && !back.some(x => x.id === B.pid));
// role isolation: viewer in B must not write in B
await cd.rpc("set_active_tenant", { _tenant_id: tb });
const c4 = await client("isolation-a@tahqaq.test");
const wr = await c4.from("suppliers").insert({ name: "viewer-write" }).select("id");
check("role-not-carried-across-tenants", !!wr.error, wr.error?.code ?? "");

// cleanup: archive test tenants and remove their rows
for (const t of [ta, tb]) {
  for (const tbl of ["invoice_line_items","invoices","requests","attachments","suppliers","project_supervisors","project_members","projects","notifications","audit_log","tenant_memberships"]) {
    await admin.from(tbl).delete().eq("tenant_id", t);
  }
  await admin.from("tenants").update({ status: "archived", deleted_at: new Date().toISOString() }).eq("id", t);
}
for (const u of [ua, ub]) await admin.from("profiles").update({ active_tenant_id: null }).eq("user_id", u);
await admin.storage.from("attachments").remove([A.path, B.path]);
console.log(R.join("\n"));
console.log(`\nTOTAL pass=${ok} fail=${fail}`);
