/**
 * دالة خادم عامة (بلا تسجيل): المسار البديل لقسم قديم بعد الدمج أو التخفيض.
 * ملف رقيق — المنطق في `mkt-category-redirects.server.ts`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { resolveRedirectPath } from "@/lib/mkt-category-redirects.server";

export const getCategoryRedirect = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ fromPath: z.string().min(1).max(200) }).parse(data))
  .handler(async ({ data }) => ({ toPath: await resolveRedirectPath(data.fromPath) }));
