import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { serverRedirectFor } from "./lib/routes-map";


type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/**
 * Permanent redirects for retired URLs — decided here, before the app renders.
 *
 * A client-side `beforeLoad` redirect is invisible to a crawler (it sees an
 * empty shell) and passes no search signal. Answering with a real 301 keeps
 * every indexed or bookmarked link working AND transfers its ranking to the
 * canonical URL, which is what made the route renames safe.
 *
 * Only document navigations are considered: assets, server functions and API
 * routes are handed to the app untouched. Every 301 target is the same for all
 * callers; the one identity-dependent destination is `/go`, which resolves the
 * caller in the browser instead of being a cacheable redirect — so `/me` and
 * `/audit` answer an uncacheable 302 to `/go` and stop there — see `routes-map.ts`.
 *
 * Each hit is logged once to the server log so retiring an old URL later is a
 * decision based on real traffic rather than a guess. Path only — no query
 * string, no referrer, no IP, nothing that identifies a visitor.
 */
function permanentRedirect(request: Request): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const url = new URL(request.url);
  const path = url.pathname;
  if (
    path.startsWith("/api/") ||
    path.startsWith("/_serverFn") ||
    path.startsWith("/_build") ||
    path.startsWith("/assets/") ||
    path.startsWith("/@") ||
    path.startsWith("/node_modules/") ||
    path.startsWith("/lovable") ||
    path.includes(".")
  ) {
    return null;
  }

  const target = serverRedirectFor(path);
  // No rule: normalise a trailing slash so `/about/` and `/about` are one URL.
  const resolved =
    target ?? (path.length > 1 && path.endsWith("/") ? path.replace(/\/+$/, "") : null);
  if (!resolved) return null;

  const [targetPath = resolved, targetHash = ""] = resolved.split("#");
  const location = `${targetPath}${targetPath.includes("?") ? "" : url.search}${targetHash ? `#${targetHash}` : ""}`;
  // Only a mapped rule is worth counting; a trailing-slash tidy-up is noise.
  if (target) console.info(`[legacy-route] ${path} -> ${targetPath}`);

  // `/go` is the identity resolver: the screen a caller ends up on depends on who
  // they are. Sending a cacheable 301 there would let a browser, a CDN or a
  // shared proxy remember the hop permanently for URLs whose meaning is personal
  // (`/me`, `/audit`), so those answer a temporary, uncacheable redirect instead.
  // Every other target is the same for all callers and stays a cacheable 301.
  const identityDependent = targetPath === "/go" || targetPath.startsWith("/go?");
  return new Response(null, {
    status: identityDependent ? 302 : 301,
    headers: {
      location,
      "cache-control": identityDependent
        ? "no-store, no-cache, must-revalidate"
        : "public, max-age=3600",
    },
  });
}


export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const redirect = permanentRedirect(request);
      if (redirect) return redirect;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);

    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
