# Final execution + verification pass — 11/08/2026

Scope: closing the last three orders (login restore, auth consolidation, dedup).
No Publish. No schema migration. No account mutated in this pass.

## 1. Auth redirect configuration

### Management API availability — NOT available
`compgen -e` in the build environment exposes only:
`SUPABASE_URL`, `SUPABASE_PROJECT_ID`, `SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` (+ the `VITE_*` mirrors).
There is **no `SUPABASE_ACCESS_TOKEN` / Management API (PAT) token**, so
`PATCH /v1/projects/{ref}/config/auth` cannot be called from here. The service-role
key reaches the **Auth Admin API** (users, generate_link) but *not* project config.
No value was guessed or invented.

### QA-safe measurement of where a recovery link lands today
Probe with a deliberately invalid token (no live token consumed):

```
GET https://rgpnhzovtceitqxpiilf.supabase.co/auth/v1/verify
    ?token=<invalid>&type=recovery
    &redirect_to=https://www.kaheel.market/reset-password
→ HTTP/2 303
  location: https://check-your-name-ai.vercel.app#error=access_denied&error_code=otp_expired…
```

Same result with `redirect_to=https://evil.example.com/x` → also
`https://check-your-name-ai.vercel.app`.

**Conclusion (measured, not inferred):** `redirect_to` is *ignored entirely*
because none of the Kaheel origins are in the allow-list, so Auth falls back to
`SITE_URL`, which is still the retired `https://check-your-name-ai.vercel.app`.

A real (now-consumed) owner recovery token was followed once to confirm the
success path, not just the error path:

```
landing: https://check-your-name-ai.vercel.app
hash keys: access_token, expires_at, expires_in, refresh_token, sb, token_type, type
```

So the tokens themselves are valid and complete; only the landing origin is wrong.

### Remaining manual action (the ONLY one)
Supabase Dashboard → project `rgpnhzovtceitqxpiilf` → **Authentication → URL Configuration**:

1. **Site URL** → `https://www.kaheel.market`
2. **Redirect URLs** → add all of:
   - `https://www.kaheel.market/*`
   - `https://kaheel.market/*`
   - `https://aheelmarket.lovable.app/*`
   - `https://id-preview--e4af4416-92f0-4e72-9296-39a81d60b485.lovable.app/*`
3. Save, then re-issue recovery links — `redirect_to=…/reset-password` will then be honoured.

### Fresh recovery links (issued 11/08/2026, `redirect_to` requested = `https://www.kaheel.market/reset-password`)
Until step 1–2 above are done these still land on the retired origin; the hash
fragment is nonetheless a valid recovery session (see §2 for the proven workaround).

- `o11339911@gmail.com` (owner)
  `https://rgpnhzovtceitqxpiilf.supabase.co/auth/v1/verify?token=87a714e3993c77130ee79e441b0e5c4104138a0b7f858954db5c2c23&type=recovery&redirect_to=https://check-your-name-ai.vercel.app`
- `b11339911@gmail.com`
  `https://rgpnhzovtceitqxpiilf.supabase.co/auth/v1/verify?token=2fb102fb1805fb3bd7f85759a5bc80e4d420836cc362df02a57225ea&type=recovery&redirect_to=https://check-your-name-ai.vercel.app`
- `a-w112233@gmail.com`
  `https://rgpnhzovtceitqxpiilf.supabase.co/auth/v1/verify?token=f92e9dca27c67b0ee86110591b228db4d7eab8a6746c3a9b6723c5ca&type=recovery&redirect_to=https://check-your-name-ai.vercel.app`

## 2. End-to-end smoke verification (measured)

### Redirects (`curl -D -`, dev server)
| Request | Status | Location |
|---|---|---|
| `/register?invite=abc` | 301 | `/auth?invite=abc&tab=register` |
| `/signup` | 301 | `/auth?tab=register` |
| `/sign-up` | 301 | `/auth?tab=register` |
| `/login` | 301 | `/auth` |

Query parameters are preserved and merged (invite token survives).

### `/auth` (Playwright, 390×1200)
- Buttons found in order: `العربية`, `English`, **`دخول`**, **`إنشاء حساب`**, `رمز تحقق`, `كلمة المرور`, `أرسل رمز التحقق`
  → both canonical tabs present, one identifier surface, OTP notice shown once.
- Clicking `إنشاء حساب` → URL becomes `http://localhost:8080/auth?tab=register` (deep-link state preserved).
- **Console errors: 0** (console + `pageerror` listeners both empty).
- Screenshots: `/tmp/browser/auth/signin.png`, `/tmp/browser/auth/register.png`.

### `resolve_login_candidates` — 6 identifier formats
Called through PostgREST RPC with the service role.

| Input | Candidates | Emails resolved |
|---|---|---|
| `o11339911@gmail.com` | 1 | o11339911@gmail.com |
| `0552311766` | 3 | b11339911, a-w112233, **o11339911** |
| `552311766` | 3 | b11339911, a-w112233, **o11339911** |
| `+966552311766` | 3 | b11339911, a-w112233, **o11339911** |
| `966552311766` | 3 | b11339911, a-w112233, **o11339911** |
| `00966552311766` | 3 | b11339911, a-w112233, **o11339911** |

All rows return `is_active: true`, `locked: false` — no restriction table entry and
no session-revocation guard blocks either account.

### `/reset-password` recovery-session handling
Behaviour (code-inspected **and** executed with a real token):
- `src/integrations/supabase/client.ts` leaves `detectSessionInUrl` at its default
  (`true`) and the default implicit flow, so supabase-js consumes the
  `#access_token=…&type=recovery` fragment on load and emits `PASSWORD_RECOVERY`.
- The route subscribes with `onAuthStateChange` **and** calls `getSession()`, gating
  the form on `Boolean(session)`; while undecided it shows `auth.recoveryChecking`,
  and with no session it shows `auth.recoveryExpired` + a link to `/forgot-password`.
- Executed test: navigating to `http://localhost:8080/reset-password#<real recovery hash>`
  rendered the form (`#new-password` present, 1 match), zero page errors.
  On success it calls `updateUser({ password })`, signs out, and redirects to `/auth`.
- **Workaround valid today, before the dashboard fix:** open the recovery link, then
  copy everything from `#` onward off the retired landing URL and paste it after
  `https://www.kaheel.market/reset-password` — the session is established from the hash.

### Admin routes + typecheck
| Path | Status |
|---|---|
| `/admin/support` | 200 |
| `/admin/ops-log` | 200 |
| `/admin/chat-reports` | 200 |
| `/auth` | 200 |
| `/reset-password` | 200 |

`bunx tsgo --noEmit` → **clean, zero diagnostics**.

### `mkt_ops_log` — `account.login_restored`
Two rows present, both at `2026-08-11 01:38:31+00`, unit `platform`, entity `auth.users`:

1. `entity_id 04204bf7-caaa-4dcb-a0e3-f8d5e6d85269` — owner account verified healthy
   (email confirmed, no ban, `system_owner` intact); recovery link issued; login
   resolver extended to `mkt_user_contacts` phone.
   meta.reason = `owner cannot sign in`; identifiers `[o11339911@gmail.com, 0552311766]`.
2. `entity_id 4f54fa13-a380-4462-8252-afe87424a99f` — phone identifier `0552311766`
   now resolves in every typed format; recovery link issued.
   meta.reason = `phone-format login normalization gap`; `variants_tested: 6`.

## 3. Verdict
Everything executable from inside the project is executed and measured. The single
outstanding item is the Supabase Auth URL configuration, which requires a Management
API token or dashboard access that this environment does not hold.

## 4. Owner pragmatic unblock — 11/08/2026 02:31 UTC

Scope was restricted to Auth user `04204bf7-caaa-4dcb-a0e3-f8d5e6d85269`
(`o11339911@gmail.com`). No other account was modified and nothing was published.

### Temporary password

The Auth Admin API accepted the password update (`PUT /auth/v1/admin/users/{id}` →
HTTP 200) and returned the expected owner user ID. The generated password is 20
characters, contains uppercase/lowercase letters and digits, and excludes ambiguous
`l`, `I`, `O`, and `0`. It was delivered directly to the owner in the completion
message and is intentionally **not persisted in this repository**.

### Published-flow end-to-end proof

Both public entry URLs currently return HTTP 200 and redirect to the canonical
`https://kaheel.market/auth`. The rendered published screen contains password mode.
Each verification used that real screen and its `signInWithIdentifier` server function,
then observed the Supabase session written by the password grant.

| Identifier entered | Result | Session user ID | Test sign-out |
|---|---|---|---|
| `o11339911@gmail.com` | SUCCESS | `04204bf7-caaa-4dcb-a0e3-f8d5e6d85269` | HTTP 204 |
| `0552311766` | SUCCESS | `04204bf7-caaa-4dcb-a0e3-f8d5e6d85269` | HTTP 204 |

Therefore the owner can sign in **today** at `https://www.kaheel.market/auth`; it
redirects to `https://kaheel.market/auth`, which is the exact working canonical URL.
`https://aheelmarket.lovable.app/auth` also redirects to the same working screen.
Contrary to the earlier preview-only assumption, the published auth page does contain
password sign-in. The database-backed phone resolver is live in the published flow;
entering `0552311766` resolved to and authenticated the owner account successfully.

### Operations evidence

`mkt_ops_log` contains one new append-only row:

- action: `account.temp_password_issued`
- actor/entity ID: `04204bf7-caaa-4dcb-a0e3-f8d5e6d85269`
- unit: `account`
- timestamp: `2026-08-11 02:31:14.234996+00`
- reason: `recovery redirect blocked by stale auth URL config`

The permanent recovery fix remains unchanged: update Supabase Authentication → URL
Configuration with the Kaheel Site URL and redirect allow-list documented in §1.

## 5. Auth URL configuration CONFIRMED — 11/08/2026 02:4x UTC

The owner's dashboard change (Site URL `https://www.kaheel.market`, 3 redirect
patterns) is live and verified from here. QA-safe probes first:

| Probe (`type=recovery`, deliberately invalid token) | Status | Location |
|---|---|---|
| `redirect_to=https://www.kaheel.market/reset-password` | 303 | `https://www.kaheel.market/reset-password#error=access_denied&error_code=otp_expired…` |
| `redirect_to=https://evil.example.com/x` | 303 | `https://www.kaheel.market#error=access_denied…` (allow-list rejects the evil origin, falls back to Site URL) |

The retired origin `check-your-name-ai.vercel.app` no longer appears in either case.

### Real recovery link followed once (`b11339911@gmail.com`)

Requested `redirect_to=https://www.kaheel.market/reset-password`; followed with
`curl -D -` exactly once (that token is now consumed):

```
303 → https://www.kaheel.market/reset-password#access_token=…&expires_in=3600
      &refresh_token=…&token_type=bearer&type=recovery
```

Decoded JWT: `sub 4f54fa13-a380-4462-8252-afe87424a99f`, `email b11339911@gmail.com`,
`amr[0].method = otp`. So `redirect_to` is now honoured and the recovery session is
delivered to the canonical Kaheel origin.

**The recovery-link issue is closed permanently.** No hash-copy workaround is needed
any more; recovery links land directly on `/reset-password`, which establishes the
session from the fragment and renders the new-password form.

### Fresh, unconsumed recovery link for the owner to use

`b11339911@gmail.com`:
`https://rgpnhzovtceitqxpiilf.supabase.co/auth/v1/verify?token=62ea6484afd2bae4c39b3002dde5302cc2881a4482c2a676983732a2&type=recovery&redirect_to=https://www.kaheel.market/reset-password`

Nothing was published and no account was modified in this pass.
