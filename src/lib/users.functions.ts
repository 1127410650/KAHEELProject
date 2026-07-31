import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createAppUserImpl, updateAppUserImpl } from "./users.server";

const roleSchema = z.enum(["accountant", "employee", "supervisor"]);

const createSchema = z.object({
  full_name: z.string().min(2).max(200),
  national_id: z.string().min(5).max(30),
  phone: z.string().min(6).max(30),
  email: z.string().email(),
  role: roleSchema,
  supervisor_id: z.string().uuid().nullable().optional(),
  project_ids: z.array(z.string().uuid()).default([]),
  permissions: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
  must_change_password: z.boolean().default(true),
  password: z.string().min(8).max(72),
});

const updateSchema = z.object({
  user_id: z.string().uuid(),
  role: roleSchema.optional(),
  supervisor_id: z.string().uuid().nullable().optional(),
  project_ids: z.array(z.string().uuid()).optional(),
  permissions: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
  reset_password: z.string().min(8).max(72).nullable().optional(),
});

export const createAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => createAppUserImpl(context.supabase, data));

export const updateAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ data, context }) => updateAppUserImpl(context.supabase, data));
