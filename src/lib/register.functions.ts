import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import {
  registerAccountImpl,
  type RegisterInput,
  type RegisterResult,
} from "@/lib/register.server";

/**
 * Invite-only account creation. There is no public sign-up: the handler refuses
 * any call without a live invitation token and takes the email from that
 * invitation, never from the browser. Rate limited server-side.
 */
export const registerAccount = createServerFn({ method: "POST" })
  .validator((data: RegisterInput) => data)
  .handler(async ({ data }): Promise<RegisterResult> => {
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
    return registerAccountImpl(data, clientKey);
  });
