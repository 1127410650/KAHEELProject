# Mobile Native Security Foundation — 2026-08-07

## Final status of this foundation phase

- Branch: `feat/mobile-ios-android-secure-foundation`
- Draft PR: `#21`
- Base synchronization: **current with `main` (`behind = 0`)** after maintenance sync PR `#29`
- Merge: **blocked pending the live-backend/device checks listed below**
- Store publishing/signing: **blocked**
- Latest Vercel preview on the synchronized mobile head: **passed**
- Latest read-only Native CI after the newest Kaheel session/navigation changes: **passed end-to-end**
- Deterministic npm lock: **committed and proven with clean `npm ci`**
- Android debug APK: **compiled successfully and retained as a short-lived artifact**
- iOS Simulator application: **compiled successfully without signing**
- Compiled iOS privacy manifest: **verified inside `App.app`**
- Read-only adversarial Supabase RLS/Storage harness: **implemented; live execution still pending isolated QA credentials/records**

No software can be guaranteed impossible to compromise. The release requirement remains defense in depth, fail-closed behavior, strict server-side authorization, repeatable builds, adversarial authorization testing, and evidence from real devices before public distribution.

## Architecture and security controls implemented

1. The native application bundles the reviewed SPA inside the Android/iOS application package. Production application code is not loaded through Capacitor `server.url` or `allowNavigation`.
2. Normal web SSR remains enabled. Nitro is disabled **only** during the native SPA build so TanStack Start can produce the local prerender server/output required for `dist/client/index.html`.
3. Supabase RLS/server authorization remains the authority for data access. The client-side application does not receive service-role or secret keys.
4. Native sessions use Keychain/Keystore-backed secure storage. A first-install marker clears iOS Keychain session material that can survive uninstall/reinstall.
5. Native authentication storage accepts only the current Supabase auth key prefix and applies a bounded value size.
6. Supabase client requests are constrained to the configured HTTPS origin, use PKCE, omit browser-cookie authority, and reject unsafe redirects.
7. Deep links are checked for exact HTTPS origin, credentials, unexpected port, control characters, ambiguous paths, excessive length, and URL-borne access/refresh/provider tokens before local routing.
8. Password recovery uses the approved HTTPS recovery route. PKCE codes are exchanged only on `/reset-password`, removed before local history navigation, and are not logged.
9. The final generated native SPA receives exactly one reviewed Content Security Policy. The finalizer rejects unsafe/non-HTTPS Supabase origins and verifies explicit HTTPS/WSS connection origins, `object-src 'none'`, `frame-src 'none'`, `frame-ancestors 'none'`, `base-uri 'none'`, `form-action 'self'`, and no `unsafe-eval`.
10. Android cleartext traffic, mixed content, application backup, broad storage/package/install permissions, user-installed CA trust, and WebView debugging are prohibited.
11. iOS arbitrary transport loads, local-network transport exceptions, file sharing, opening documents in place, and WebView debugging are prohibited.
12. Android baseline is API 23 or newer. The generated project uses compile/target API 35 in validation.
13. iOS deployment target is 14.0 or newer.
14. Apple `PrivacyInfo.xcprivacy` declares UserDefaults required-reason API use with reason `CA92.1`, is linked into Xcode resources, and is verified in the compiled simulator `.app`.
15. Native dependencies are pinned to the reviewed Capacitor 7 set: Core/Android/iOS/CLI `7.6.8`, App `7.1.2`, Preferences `7.0.4`, secure storage `0.12.0`.
16. A full-screen privacy shield is bundled and shown for inactive/pause states so App Switcher snapshots do not expose application content.
17. The existing WebRTC voice feature receives least-privilege microphone access only: Android `RECORD_AUDIO` and iOS `NSMicrophoneUsageDescription`. Camera, location, broad storage, and unrelated permissions were not added.
18. `viewport-fit=cover`, dynamic viewport units, and safe-area insets are guarded for notches, Dynamic Island, rounded corners, and bottom gesture areas.
19. Signing keys, certificates, provisioning profiles, environment secrets, APNs/FCM secrets, and Android local signing properties are not committed.
20. Permanent Native CI has `contents: read`, checkout does not persist credentials, and GitHub Actions are pinned to immutable commit SHAs.

## Dependency reproducibility findings and fixes

Two real dependency/build issues were found and fixed instead of bypassed:

- `capacitor-secure-storage-plugin@0.13.0` targets Capacitor 8, so it was replaced by the reviewed Capacitor 7-compatible `0.12.0`.
- npm initially produced an Ajv peer graph that `npm install` accepted but clean `npm ci` rejected. Root `ajv@8.20.0` is now explicit for the optional modern peer while ESLint retains nested `ajv@6.15.0`.

The committed npm lock is lockfile v3 and is guarded so that:

- root dependencies/devDependencies exactly match `package.json`;
- the reviewed mobile dependency versions are exact;
- root Ajv 8 and nested ESLint-compatible Ajv 6 are both present;
- resolved package sources must use the official npm registry URL;
- resolved entries must contain SHA-512 integrity values;
- Native CI installs from the committed lock with `npm ci --ignore-scripts --no-fund --no-audit` rather than regenerating dependencies.

## Latest validated CI evidence

Latest read-only workflow run: `31201353655`, after synchronizing the two newest `main` commits through maintenance PR `#29` and preserving PR `#21` as Draft.

Every validation step completed successfully:

1. Locked dependency installation with `npm ci` and lifecycle scripts disabled.
2. Client secret scan.
3. Production dependency audit at high/critical threshold.
4. Normal web/TanStack build.
5. Native SPA build and final CSP verification.
6. Capacitor Android/iOS project generation and synchronization.
7. Android/iOS hardening and native release checks.
8. Capacitor Doctor.
9. Android `assembleDebug` compilation.
10. iOS Simulator Xcode compilation with signing disabled.
11. Verification that `PrivacyInfo.xcprivacy` exists inside the compiled `App.app`.
12. Upload of generated native projects and Android debug APK as short-lived review artifacts.

Artifacts from run `31201353655`:

- Android debug artifact ID `9003084830`, SHA-256 digest `8edcab6780b45af30285b814e8ce4b12861756840e1e5212f9abca8c8239d6f4`.
- Native projects artifact ID `9003083877`, SHA-256 digest `ab8396d7f24b0fc9ccd632691f62dd7ea2a1e44aa45c0fecd5545564297f70a6`.
- Both artifacts expire on 2026-08-14.

A generated-project review confirmed the expected permission posture: the final Android application manifest requests `INTERNET` and `RECORD_AUDIO`; iOS contains the microphone usage description and reviewed transport/privacy settings, without adding camera, location, or broad storage permission.

## Adversarial Supabase isolation harness

A separate manual workflow, `.github/workflows/supabase-adversarial-rls.yml`, and script, `scripts/test-adversarial-rls.mjs`, were added for live authorization testing without weakening normal CI.

The harness is deliberately read-only and requires the explicit confirmation string `RLS-QA-READONLY`. It also requires two different authenticated QA users, two different tenants, two projects, two attachment records, and two private storage objects. It rejects expired/non-authenticated/service-role credentials and pins the reviewed Supabase project reference `fdmovlxyqebtgzhsroac` unless an explicit custom-domain override is supplied.

For both A→B and B→A directions it verifies:

- the actor can read its own reviewed project row;
- direct foreign project-ID reads are hidden/denied;
- foreign `tenant_id` query tampering does not expose project rows;
- the actor can read its own reviewed attachment row;
- direct foreign attachment-ID reads are hidden/denied;
- foreign `tenant_id` query tampering does not expose attachment rows;
- the actor can read its own reviewed private Storage object;
- the foreign Storage object is not readable.

Tokens and row payloads are not printed in failure messages. The workflow has `contents: read` only and does not run automatically. Live execution has **not** yet been recorded because the connected Supabase integration did not expose an invokable API surface in this session and the required isolated QA access tokens/record IDs are not present in the repository. This remains a release blocker rather than being marked as passed.

## Recovery configuration pinned in source

The reviewed Supabase project reference is `fdmovlxyqebtgzhsroac`. The native recovery redirect pinned by source is exactly:

`https://check-your-name-ai.vercel.app/reset-password`

Source checks reject localhost, cleartext recovery origins, and native recovery through the local Capacitor origin. The exact URL still must be added/verified in the actual Supabase Auth redirect allowlist with **no wildcard** and exercised against live Auth before release.

## Remaining blockers that require external configuration, credentials, or real-device evidence

The source/build foundation is complete, but these items remain mandatory before merge/signing/public release:

1. Add and verify `https://check-your-name-ai.vercel.app/reset-password` in the actual Supabase Auth redirect allowlist, with no wildcard, then test it against the real Auth configuration.
2. Configure isolated QA secrets/records and execute the manual read-only RLS/Storage workflow successfully in both directions. Then run write-path/payload-tampering authorization tests in a dedicated disposable QA dataset before public release.
3. Run authenticated real-device tests on Android and iPhone for login, logout, refresh, reinstall behavior, offline/online transition, revoked session behavior, recovery completion, microphone allow/deny, Safe Area rendering, and App Switcher privacy.
4. Test recovery callbacks adversarially against real Auth: expired/replayed/malformed codes, credential-bearing fragments, unapproved origins, and malicious redirect inputs.
5. Confirm the final App Store Bundle ID and Android Application ID before signing. The current technical identifier remains `com.kahli.marketplace` and must not be silently changed without the final identifier decision.
6. Configure release signing outside the repository and document signing-key/provisioning rotation and recovery procedures.
7. Configure Universal/App Links only after Android signing fingerprints and the Apple Team ID are available; then publish and verify Android `assetlinks.json` and the Apple association file.
8. Run release-mode tests on physical non-rooted/non-jailbroken devices and separately evaluate the desired behavior/risk policy for compromised devices.
9. Complete an independent penetration test before public release.
10. Prepare App Store privacy disclosures and Google Play data-safety declarations from the final data/permission inventory.

## Release rule

A failed, missing, skipped, or unobservable security check remains a failure. Keep PR `#21` as Draft and do not merge, sign, distribute, or publish until the remaining live-backend/device blockers have evidence and unresolved Critical/High security findings are zero.
