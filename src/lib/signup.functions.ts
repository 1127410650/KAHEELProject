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
  .inputValidator((data: PublicSignupInput) => data)
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
