// Server-only user administration. Requires a verified accountant caller.
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { PERMISSIONS } from "@/lib/permissions";
import { passwordPolicyError } from "@/lib/password-policy";

type Client = SupabaseClient<Database>;

export interface CreateUserInput {
  full_name: string;
  national_id: string;
  phone: string;
  email: string;
  role: "accountant" | "employee" | "supervisor";
  supervisor_id?: string | null | undefined;
  project_ids: string[];
  permissions: string[];
  is_active: boolean;
  must_change_password: boolean;
  password: string;
}

async function assertAccountant(userClient: Client) {
  const { data, error } = await userClient.rpc("is_accountant");
  if (error || data !== true) throw new Error("FORBIDDEN");
}

/** Active workspace of the caller — every role/permission row is bound to it. */
async function callerTenantId(userClient: Client): Promise<string> {
  const { data, error } = await userClient.rpc("current_tenant_id");
  if (error || !data) throw new Error("NO_ACTIVE_TENANT");
  return data as string;
}


export async function createAppUserImpl(userClient: Client, input: CreateUserInput) {
  await assertAccountant(userClient);
  // Same strength policy as every other password path in the app.
  if (passwordPolicyError(input.password)) throw new Error("WEAK_PASSWORD");
  const tenantId = await callerTenantId(userClient);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");


  const permissions = input.permissions.filter((p) =>
    (PERMISSIONS as readonly string[]).includes(p),
  );

  const created = await supabaseAdmin.auth.admin.createUser({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name },
  });
  if (created.error || !created.data.user) {
    throw new Error(created.error?.message.includes("already") ? "EMAIL_TAKEN" : "CREATE_FAILED");
  }
  const userId = created.data.user.id;

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        full_name: input.full_name.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone.trim(),
        national_id: input.national_id.trim(),
        supervisor_id: input.role === "supervisor" ? (input.supervisor_id ?? null) : null,
        is_active: input.is_active,
        must_change_password: input.must_change_password,
      },
      { onConflict: "user_id" },
    );
  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    throw new Error(profileError.message.includes("duplicate") ? "DUPLICATE" : "CREATE_FAILED");
  }

  // Membership first: roles/permissions only exist for an active member of this workspace.
  await supabaseAdmin
    .from("tenant_memberships")
    .upsert(
      { tenant_id: tenantId, user_id: userId, role: input.role, status: "active" },
      { onConflict: "tenant_id,user_id" },
    );

  await supabaseAdmin
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("tenant_id", tenantId);
  await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: userId, role: input.role, tenant_id: tenantId });

  if (permissions.length) {
    await supabaseAdmin
      .from("user_permissions")
      .insert(
        permissions.map((permission) => ({ user_id: userId, permission, tenant_id: tenantId })),
      );
  }
  if (input.project_ids.length) {
    await supabaseAdmin
      .from("project_members")
      .insert(
        input.project_ids.map((project_id) => ({
          user_id: userId,
          project_id,
          tenant_id: tenantId,
        })),
      );
  }


  await userClient.rpc("log_audit", {
    _entity_type: "user",
    _action: "create",
    _entity_id: userId,
    _new_value: {
      role: input.role,
      permissions,
      projects: input.project_ids,
      supervisor_id: input.supervisor_id ?? null,
    } as never,
  });

  return { user_id: userId };
}

export interface UpdateUserInput {
  user_id: string;
  role?: "accountant" | "employee" | "supervisor" | undefined;
  supervisor_id?: string | null | undefined;
  project_ids?: string[] | undefined;
  permissions?: string[] | undefined;
  is_active?: boolean | undefined;
  reset_password?: string | null | undefined;
}

export async function updateAppUserImpl(userClient: Client, input: UpdateUserInput) {
  await assertAccountant(userClient);
  const tenantId = await callerTenantId(userClient);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // An accountant may only administer members of their own workspace.
  const { data: membership } = await supabaseAdmin
    .from("tenant_memberships")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", input.user_id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) throw new Error("NOT_IN_TENANT");

  const [{ data: prevRoles }, { data: prevPerms }, { data: prevMembers }] = await Promise.all([
    supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", input.user_id)
      .eq("tenant_id", tenantId),
    supabaseAdmin
      .from("user_permissions")
      .select("permission")
      .eq("user_id", input.user_id)
      .eq("tenant_id", tenantId),
    supabaseAdmin
      .from("project_members")
      .select("project_id")
      .eq("user_id", input.user_id)
      .eq("tenant_id", tenantId),
  ]);
  const before = {
    role: (prevRoles ?? [])[0]?.role ?? null,
    permissions: (prevPerms ?? []).map((r) => r.permission).sort(),
    projects: (prevMembers ?? []).map((r) => r.project_id),
  };


  if (input.role) {
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", input.user_id)
      .eq("tenant_id", tenantId);
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: input.user_id, role: input.role, tenant_id: tenantId });
    await supabaseAdmin
      .from("tenant_memberships")
      .update({ role: input.role })
      .eq("tenant_id", tenantId)
      .eq("user_id", input.user_id)
      .neq("role", "owner");
  }

  const profilePatch: Database["public"]["Tables"]["profiles"]["Update"] = {
    ...(input.supervisor_id !== undefined ? { supervisor_id: input.supervisor_id } : {}),
    ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
  };
  if (Object.keys(profilePatch).length) {
    await supabaseAdmin.from("profiles").update(profilePatch).eq("user_id", input.user_id);
  }


  // Disabling an account also terminates its sessions.
  if (input.is_active === false) {
    await supabaseAdmin.auth.admin.updateUserById(input.user_id, { ban_duration: "876000h" });
    await supabaseAdmin.auth.admin.signOut(input.user_id, "global").catch(() => undefined);
  } else if (input.is_active === true) {
    await supabaseAdmin.auth.admin.updateUserById(input.user_id, { ban_duration: "none" });
  }

  if (input.permissions) {
    const permissions = input.permissions.filter((p) =>
      (PERMISSIONS as readonly string[]).includes(p),
    );
    await supabaseAdmin
      .from("user_permissions")
      .delete()
      .eq("user_id", input.user_id)
      .eq("tenant_id", tenantId);
    if (permissions.length) {
      await supabaseAdmin.from("user_permissions").insert(
        permissions.map((permission) => ({
          user_id: input.user_id,
          permission,
          tenant_id: tenantId,
        })),
      );
    }
  }

  if (input.project_ids) {
    await supabaseAdmin
      .from("project_members")
      .delete()
      .eq("user_id", input.user_id)
      .eq("tenant_id", tenantId);
    if (input.project_ids.length) {
      await supabaseAdmin.from("project_members").insert(
        input.project_ids.map((project_id) => ({
          user_id: input.user_id,
          project_id,
          tenant_id: tenantId,
        })),
      );
    }
  }


  if (input.reset_password) {
    await supabaseAdmin.auth.admin.updateUserById(input.user_id, {
      password: input.reset_password,
    });
    await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("user_id", input.user_id);
  }

  await userClient.rpc("log_audit", {
    _entity_type: "user",
    _action: "update",
    _entity_id: input.user_id,
    _old_value: before as never,
    _new_value: {
      role: input.role ?? before.role,
      permissions: (input.permissions ?? before.permissions).slice().sort(),
      projects: input.project_ids ?? before.projects,
      is_active: input.is_active ?? null,
      password_reset: !!input.reset_password,
    } as never,

  });

  return { ok: true };
}

/** Read-only reconciliation: which profiles have a matching auth user. Never deletes/merges. */
export async function listAuthLinksImpl(userClient: Client) {
  await assertAccountant(userClient);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const ids: string[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const users = data?.users ?? [];
    users.forEach((u) => ids.push(u.id));
    if (users.length < 200) break;
  }
  return { auth_user_ids: ids };
}
