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
