# Mobile Native Security Foundation — 2026-08-07

## Final status of this foundation phase

- Branch: `feat/mobile-ios-android-secure-foundation`
- Draft PR: `#21`
- Base synchronization: **current with `main` (`behind = 0`)**
- Merge: **blocked pending the external/device checks listed below**
- Store publishing/signing: **blocked**
- Latest Vercel preview on the validated mobile head: **passed**
- Final read-only Native CI on the latest synchronized product code: **passed end-to-end**
- Deterministic npm lock: **committed and proven with clean `npm ci`**
- Android debug APK: **compiled successfully and retained as a short-lived artifact**
- iOS Simulator application: **compiled successfully without signing**
- Compiled iOS privacy manifest: **verified inside `App.app`**

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
12. Android baseline is API 23 or newer. The generated project used compile/target API 35 in validation.
13. iOS deployment target is 14.0 or newer.
14. Apple `PrivacyInfo.xcprivacy` declares UserDefaults required-reason API use with reason `CA92.1`, is linked into Xcode resources, and was verified in the compiled simulator `.app`.
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

## Final validated CI evidence

Final read-only workflow run: `31199387061`, on the mobile branch after merging the then-current `main` and restoring the permanent read-only workflow.

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

Artifacts from the final run:

- Android debug artifact ID `9002309156`, SHA-256 digest `6a824344ca82321f5d2f467f91351297b83abc9aabdeefd91feb99820dfd0301`.
- Native projects artifact ID `9002306284`, SHA-256 digest `c5992838d49428c273886e0fbdbed1efaea42a78116ad3adc2cd0d49b0d8ff98`.
- Both artifacts are configured to expire on 2026-08-14.

A generated-project review also confirmed the expected permission posture: Android requests `INTERNET` and `RECORD_AUDIO`; iOS contains the microphone usage description and the reviewed transport/privacy settings, without adding camera, location, or broad storage permission.

## Remaining blockers that require external configuration, credentials, or real-device evidence

The source/build foundation is complete, but these items remain mandatory before merge/signing/public release:

1. Add the approved password-recovery URL to the actual Supabase Auth redirect allowlist, with no wildcard, and test it against the production-like Auth configuration.
2. Run authenticated real-device tests on Android and iPhone for login, logout, refresh, reinstall behavior, offline/online transition, revoked session behavior, recovery completion, microphone allow/deny, Safe Area rendering, and App Switcher privacy.
3. Test recovery callbacks adversarially: expired/replayed/malformed codes, credential-bearing fragments, unapproved origins, and malicious redirect inputs against the real Auth service.
4. Run adversarial RLS/Storage isolation tests using real user tokens across personal accounts, entities, projects, requests, documents, and storage objects; mutate IDs, paths, URLs, payloads, and local state to confirm no cross-tenant access.
5. Confirm the final App Store Bundle ID and Android Application ID before signing. The current technical identifier remains `com.kahli.marketplace` and must not be silently changed without the final identifier decision.
6. Configure release signing outside the repository and document signing-key/provisioning rotation and recovery procedures.
7. Configure Universal/App Links only after Android signing fingerprints and the Apple Team ID are available; then publish and verify Android `assetlinks.json` and the Apple association file.
8. Run release-mode tests on physical non-rooted/non-jailbroken devices and separately evaluate the desired behavior/risk policy for compromised devices.
9. Complete an independent penetration test before public release.
10. Prepare App Store privacy disclosures and Google Play data-safety declarations from the final data/permission inventory.

## Release rule

A failed, missing, skipped, or unobservable security check remains a failure. Keep PR `#21` as Draft and do not merge, sign, distribute, or publish until the remaining external/device blockers have evidence and unresolved Critical/High security findings are zero.
