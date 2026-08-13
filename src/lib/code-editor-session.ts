/**
 * فحص وجود الجلسة قبل وسيط المصادقة المولّد.
 *
 * إن انتهت الجلسة أو استُدعيت الدالة بلا رمز حامل، فإن الوسيط المولّد يرفع
 * خطأً عامًا يظهر كـ500 وشاشة بيضاء. هذا الوسيط يسبقه ويعيد استجابة 401
 * صريحة يمسكها نداء الواجهة ويعرضها كرسالة واضحة.
 */
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const requireSessionHeader = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const authHeader = getRequest()?.headers?.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Response("NO_SESSION", {
        status: 401,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    return next();
  },
);
