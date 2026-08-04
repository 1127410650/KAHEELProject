import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import {
  publicSignupImpl,
  type PublicSignupInput,
  type PublicSignupResult,
} from "@/lib/signup.server";

/**
 * Public marketplace sign-up. Creates an ordinary individual user only — never a
 * role, a workspace membership or an administrative account. Rate limited per IP
 * and per email on the server.
 */
export const signUpPublic = createServerFn({ method: "POST" })
  // Projected field by field on purpose: a request that smuggles `role`,
  // `tenant_id` or `permissions` into the body loses them here, before the
  // handler ever sees them.
  .inputValidator(
    (data: PublicSignupInput & Record<string, unknown>): PublicSignupInput => ({
      full_name: String(data?.full_name ?? ""),
      email: String(data?.email ?? ""),
      phone: String(data?.phone ?? ""),
      password: String(data?.password ?? ""),
    }),
  )

  .handler(async ({ data }): Promise<PublicSignupResult> => {
    let clientKey = "unknown";
    try {
      const request = getRequest();
      clientKey =
        request.headers.get("cf-connecting-ip") ??
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown";
    } catch {
      clientKey = "unknown";
    }
    return publicSignupImpl(data, clientKey);
  });
