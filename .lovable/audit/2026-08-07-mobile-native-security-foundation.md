# Mobile Native Security Foundation — 2026-08-07

## Status

- Branch: `feat/mobile-ios-android-secure-foundation`
- Draft PR: `#21`
- Merge: **blocked**
- Publishing to App Store / Google Play: **blocked**
- Normal web preview builds on the branch: **passing on verified revisions; latest revision must also pass before merge**
- Native Android/iOS compile: **not yet proven by an observable CI result**
- Production dependency lockfile: **missing and required before merge**

No software can be guaranteed to be impossible to compromise. The release requirement is defense in depth, fail-closed behavior, strict server-side authorization, repeatable builds, and evidence from automated and adversarial tests.

## Security architecture

1. The native application bundles the reviewed SPA inside the signed Android/iOS package.
2. Production code must not be loaded through Capacitor `server.url` or `allowNavigation`.
3. Supabase RLS and server-side authorization remain the only authority for data access.
4. The mobile client may contain only a publishable/legacy anon Supabase key; secret and service-role keys are rejected.
5. Native sessions are stored in iOS Keychain and Android Keystore-backed storage.
6. A reinstall marker clears Keychain data that may survive an iOS uninstall, preventing a new installation from inheriting the former session.
7. Native authentication values are restricted to the current Supabase project key prefix and capped in size.
8. Supabase requests are restricted to the configured Supabase origin, use HTTPS outside local development, omit cookies, and reject redirects.
9. The native Content Security Policy is emitted only in the bundled mobile build, blocks remote scripts, frames, objects, base rewriting, arbitrary form targets, and `unsafe-eval`, and restricts HTTP/WebSocket connections to the configured Supabase origin.
10. Approved deep links are validated for scheme, exact origin, credentials, port, control characters, path ambiguity, length, and URL-borne access/refresh tokens, then mapped into the local router without loading remote application code.
11. Native password recovery uses the approved HTTPS public redirect instead of the local Capacitor origin. PKCE codes are exchanged only on `/reset-password`, removed before local navigation, and never logged.
12. Android cleartext traffic, mixed content, application backups, broad storage/package/install permissions, user-installed certificate authorities, and WebView debugging are prohibited.
13. Android must use API 23 or newer and must contain the synchronized local SPA entry point.
14. iOS arbitrary transport loads, local-network transport exceptions, file sharing, opening documents in place, and WebView debugging are prohibited.
15. iOS must target version 14.0 or newer and must contain the synchronized local SPA entry point.
16. Apple `PrivacyInfo.xcprivacy` is generated for Preferences/UserDefaults with approved reason `CA92.1`, added to Xcode resources, and must be present in the compiled `.app`.
17. Native dependencies are pinned to exact versions and unnecessary plugins are excluded.
18. Signing keys, certificates, provisioning profiles, environment files, and Android local signing properties are ignored by Git.
19. GitHub Actions uses read-only repository permissions and actions pinned by commit SHA.
20. Mobile build and release commands are fail-closed: the build requires the final SPA entry point, and release verification requires both generated native projects.

## Automated gates

The draft must not merge until the mobile workflow proves all of the following:

- Client secret scan passes.
- Password-recovery and PKCE security checks pass.
- Production dependency audit reports no high/critical vulnerability.
- Normal SSR web build passes.
- Native SPA build produces `dist/client/index.html`.
- Generated `index.html` contains the reviewed CSP and no `unsafe-eval`.
- Capacitor generates and synchronizes Android and iOS projects.
- Android and iOS hardening scripts complete without bypass.
- Android API and iOS deployment-target baselines pass.
- Both native projects contain the synchronized local SPA entry point.
- Security policy checker passes after native generation.
- Capacitor Doctor passes.
- Android debug APK compiles.
- iOS Simulator app compiles without signing.
- Compiled iOS app contains `PrivacyInfo.xcprivacy`.
- Generated native projects and APK are retained as short-lived review artifacts.

## Mandatory blockers before merge

1. Generate and commit `package-lock.json`, then replace installation in CI with `npm ci` for deterministic dependency resolution.
2. Obtain an observable successful native CI run and inspect its logs and artifacts.
3. Confirm no unexpected native permissions are introduced after plugin synchronization.
4. Add the approved password-recovery URL to the Supabase Auth redirect allowlist and verify that no wildcard redirect is used.
5. Run authenticated tests on Android and iOS for login, logout, refresh, reinstall, offline/online transitions, revoked sessions, and recovery completion.
6. Test recovery links, PKCE callbacks, expired links, replay attempts, malformed codes, credential-bearing fragments, and malicious redirect inputs.
7. Run adversarial RLS tests using real user tokens across personal accounts, entities, projects, requests, documents, and storage objects.
8. Verify that changing identifiers, URLs, request payloads, or local application state cannot expose another tenant's data.
9. Configure release signing outside the repository and document key rotation/recovery procedures.
10. Configure App/Universal Links only after Android signing fingerprints and the Apple Team ID are available; publish and verify `assetlinks.json` and the Apple association file.
11. Complete release-mode checks on physical non-rooted/non-jailbroken devices and separately evaluate rooted/jailbroken-device risk behavior.
12. Complete independent penetration testing before public release.
13. Prepare store privacy disclosures and data-safety declarations from the final permission/data inventory.

## Release rule

A failed, missing, skipped, or unobservable security check is treated as a failure. Do not merge, sign, distribute, or publish until every blocker has evidence and Critical/High findings are zero.
