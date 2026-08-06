import assert from "node:assert/strict";
import {
  APPROVED_MOBILE_ORIGIN,
  approvedMobileDeepLink,
} from "../src/lib/mobile-url-policy.ts";

const valid = approvedMobileDeepLink(
  `${APPROVED_MOBILE_ORIGIN}/auth?next=%2Fdashboard#verified`,
);
assert.equal(valid?.origin, APPROVED_MOBILE_ORIGIN);
assert.equal(valid?.pathname, "/auth");

assert.equal(approvedMobileDeepLink("http://check-your-name-ai.vercel.app/auth"), null);
assert.equal(approvedMobileDeepLink("https://evil.example/auth"), null);
assert.equal(
  approvedMobileDeepLink("https://user:pass@check-your-name-ai.vercel.app/auth"),
  null,
);
assert.equal(
  approvedMobileDeepLink("https://check-your-name-ai.vercel.app:444/auth"),
  null,
);

const protocolRelativePath = approvedMobileDeepLink(
  `${APPROVED_MOBILE_ORIGIN}//evil.example/auth`,
);
assert.equal(protocolRelativePath?.origin, APPROVED_MOBILE_ORIGIN);
assert.equal(
  protocolRelativePath?.href,
  `${APPROVED_MOBILE_ORIGIN}//evil.example/auth`,
);

const immutableOrigin = "https://kahli-a1b2c3d4-reviewed.vercel.app";
const immutableLink = approvedMobileDeepLink(
  `${immutableOrigin}/auth/callback?code=public-test-value`,
  immutableOrigin,
);
assert.equal(immutableLink?.origin, immutableOrigin);
assert.equal(
  approvedMobileDeepLink(`${APPROVED_MOBILE_ORIGIN}/auth`, immutableOrigin),
  null,
);
assert.equal(approvedMobileDeepLink("not-a-url"), null);
assert.equal(approvedMobileDeepLink(`${immutableOrigin}/auth`, "not-an-origin"), null);

console.log("Mobile URL policy tests passed.");
