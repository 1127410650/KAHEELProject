export const MOBILE_PREVIEW_ORIGIN = "https://check-your-name-ai.vercel.app";

// Release blocker: replace this through a reviewed code change with one immutable
// deployment origin. Do not use a mutable production alias or a branch preview alias.
export const REVIEWED_MOBILE_RELEASE_ORIGIN = "";

export function resolveMobileOrigin(environment = process.env) {
  const releaseBuild = environment.MOBILE_RELEASE_BUILD === "1";
  const configured = releaseBuild
    ? REVIEWED_MOBILE_RELEASE_ORIGIN
    : environment.MOBILE_APP_ORIGIN?.trim() || MOBILE_PREVIEW_ORIGIN;

  if (releaseBuild && !configured) {
    throw new Error(
      "Release build blocked: REVIEWED_MOBILE_RELEASE_ORIGIN has not been approved in source.",
    );
  }

  const url = new URL(configured);
  if (url.protocol !== "https:") throw new Error("Mobile application origin must use HTTPS.");
  if (url.username || url.password) throw new Error("Mobile application origin contains credentials.");
  if (url.port && url.port !== "443") throw new Error("Mobile application origin uses an unapproved port.");
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Mobile application origin must not contain a path, query, or fragment.");
  }

  const approved = releaseBuild ? REVIEWED_MOBILE_RELEASE_ORIGIN : MOBILE_PREVIEW_ORIGIN;
  if (url.origin !== approved) {
    throw new Error(`Mobile application origin is not approved: ${url.origin}`);
  }

  if (
    releaseBuild &&
    (url.origin === MOBILE_PREVIEW_ORIGIN || url.hostname.includes("-git-"))
  ) {
    throw new Error("Release build requires a reviewed immutable deployment origin.");
  }

  return url;
}
