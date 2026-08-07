# Mobile Public Release Gate — 2026-08-07

## Purpose

This gate is intentionally separate from build success. A successful Android/iOS build does **not** authorize signing, store upload, or public distribution.

The committed evidence ledger is:

`.lovable/audit/mobile-release-readiness.json`

The checker is:

`scripts/check-mobile-release-readiness.mjs`

The manual read-only workflow is:

`.github/workflows/mobile-release-readiness.yml`

The command is:

`npm run mobile:release-readiness`

## Current state

Current ledger status: **blocked**.

This is intentional. The following evidence categories are still unverified in the committed ledger:

1. Final Application ID / Bundle ID approval.
2. Supabase password-recovery redirect allowlist on the real project.
3. Live adversarial Supabase RLS/Storage isolation using two isolated QA identities/tenants.
4. Android physical-device Release validation.
5. iPhone physical-device Release validation.
6. Android release signing readiness.
7. iOS release signing/provisioning readiness.
8. Universal Links / Android App Links verification after signing identities exist.
9. Independent penetration-test evidence.
10. App Store Privacy / Google Play Data Safety completion.
11. Final unresolved Critical/High finding count recorded as integer zero.

The current technical identifier remains `com.kahli.marketplace`, but `application_id_approved` remains false until the final identifier is explicitly approved.

## Fail-closed behavior

The checker refuses release when any required evidence block is missing, not verified, has no usable evidence reference, or the final Critical/High count is not exactly zero.

Evidence references are metadata references only. The checker rejects references that appear to contain secret material such as Supabase secret/service-role material, private keys, AWS access-key patterns, JWTs, or URL-style access/refresh/password/secret/api-key values.

The ledger status must match the calculated state:

- missing/failed evidence => `blocked`
- every required evidence verified + references present + Critical/High = 0 => `ready`

The Application ID in the ledger must also match `capacitor.config.ts`.

## Gate validation

The checker was validated locally in three states:

1. **Current real ledger:** exited blocked and listed the missing external/live evidence.
2. **Synthetic complete non-secret evidence:** passed and calculated Ready.
3. **Synthetic evidence containing a token-like reference:** rejected and remained blocked.

No credentials or production tokens were committed or used for these checker tests.

## Native build regression after adding the gate

GitHub Actions run: `31206787900`

Validated head: `65256ec1f0b37bdf7283e18d64c076e5365b74da`

Result: **Success end-to-end**.

The run reconfirmed:

- locked `npm ci --ignore-scripts` installation;
- client secret scan;
- production dependency audit at the High/Critical threshold;
- normal web build;
- bundled Native SPA and CSP verification;
- Capacitor Android/iOS generation and hardening;
- Android Debug build;
- Android unsigned Release build with R8/resource shrinking and mapping file;
- merged Android Release manifest security gate;
- iOS Release Simulator build;
- compiled `PrivacyInfo.xcprivacy` verification;
- short-lived review artifacts.

Artifacts from run `31206787900`:

- Android unsigned Release: artifact `9005248615`, SHA-256 `064a49cff4b1a2dbf03c504ff1d6ff8e74e5b289ecc0c5a0c4101daa49043a31`.
- Android Debug: artifact `9005247649`, SHA-256 `96a3c7d4faaa23112e7100c158416b3162aa1e77f2acaf8c83f00e84fe864012`.
- Native projects: artifact `9005246344`, SHA-256 `f97786f264a575bbda17ecaa3b69ec3132ad79ece9caeb73fe7e6110d1f987c3`.
- Expiry: 2026-08-14.

## Release rule

The evidence ledger is the explicit final barrier in addition to existing source/build security checks. Do not merge, sign, upload to App Store/Google Play, distribute an installable Release, or mark the mobile foundation production-ready while this gate reports `blocked`.
