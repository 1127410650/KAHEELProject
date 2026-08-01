import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { registerAccountImpl, type RegisterInput, type RegisterResult } from "@/lib/register.server";

/** Public sign-up. Rate limited server-side; the browser never sees a service key. */
export const registerAccount = createServerFn({ method: "POST" })
  .inputValidator((data: RegisterInput) => data)
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
