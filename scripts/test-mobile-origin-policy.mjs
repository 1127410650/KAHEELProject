import assert from "node:assert/strict";
import {
  MOBILE_PREVIEW_ORIGIN,
  REVIEWED_MOBILE_RELEASE_ORIGIN,
  resolveMobileOrigin,
} from "./mobile-origin-policy.mjs";

assert.equal(REVIEWED_MOBILE_RELEASE_ORIGIN, "");
assert.equal(resolveMobileOrigin({}).origin, MOBILE_PREVIEW_ORIGIN);
assert.equal(
  resolveMobileOrigin({ MOBILE_APP_ORIGIN: MOBILE_PREVIEW_ORIGIN }).origin,
  MOBILE_PREVIEW_ORIGIN,
);

for (const origin of [
  "http://check-your-name-ai.vercel.app",
  "https://evil.example",
  "https://user:pass@check-your-name-ai.vercel.app",
  "https://check-your-name-ai.vercel.app:444",
  "https://check-your-name-ai.vercel.app/path",
  "https://check-your-name-ai.vercel.app?query=1",
  "https://check-your-name-ai.vercel.app#fragment",
]) {
  assert.throws(
    () => resolveMobileOrigin({ MOBILE_APP_ORIGIN: origin }),
    undefined,
    `Expected mobile origin rejection for ${origin}`,
  );
}

assert.throws(
  () => resolveMobileOrigin({ MOBILE_RELEASE_BUILD: "1" }),
  /Release build blocked/,
);

console.log("Mobile origin release policy tests passed.");
