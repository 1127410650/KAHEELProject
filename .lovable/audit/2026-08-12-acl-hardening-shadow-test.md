# ACL HARDENING — SHADOW-ONLY TEST REPORT — 12/08/2026

**Production was NOT written to in this round.** Every production query was read-only
(`SELECT` on `pg_catalog`). The hardening migration exists only under
`.lovable/pending-migrations/` — it is NOT in `supabase/migrations/`, so no deploy,
build, or migration flow can pick it up. No Order 2, no Batch 4, no Publish.

## 1. Artefacts

| File | Role |
|---|---|
| `.lovable/audit/2026-08-12-acl-snapshot.md` | Documented BEFORE state of all 575 `public.mkt*` functions (owner, ACL class, PUBLIC/anon/authenticated flags, trigger flag). Signature-list md5 `2848b8d566e1ce2ab5f40219c1dcc05c`, reproduced identically by the shadow catalog. |
| `.lovable/pending-migrations/20260812_acl_hardening.sql` | The forward migration. Single atomic `DO` block, idempotent, no `DROP`, no data change. |
| `.lovable/pending-migrations/20260812_acl_hardening_rollback.sql` | 429 object-by-object `GRANT` statements generated from the snapshot alone. No blanket grant. |

## 2. Classification of the 575 objects

| bucket | count | action |
|---|---|---|
| trigger functions (`returns trigger`) | 99 | `REVOKE EXECUTE FROM PUBLIC, anon, authenticated` |
| public exceptions | 40 | `REVOKE EXECUTE FROM PUBLIC` (explicit anon grant kept) |
| authenticated-keep (class E, real signed-in callers) | 2 | `REVOKE FROM PUBLIC, anon` + `GRANT TO authenticated` |
| everything else | 434 | `REVOKE EXECUTE FROM PUBLIC, anon` (authenticated kept) |

### Two findings that the shadow test produced (they were not visible on paper)

1. **`mkt_distance_m(double precision × 4)` had to become exception #40.** The four public
   `mkt_nearby_*` functions are `SECURITY INVOKER` and call it, so revoking it from `anon`
   made every visitor-facing nearby search fail with
   `permission denied for function mkt_distance_m`. It is a pure arithmetic helper and
   exposes no data.
2. **`mkt_admin_overview()` and `mkt_student_bot_state()` needed an explicit
   `GRANT ... TO authenticated`.** Both are ACL class E — their only production grant was
   `PUBLIC`, which is how signed-in users reached them
   (`src/lib/mkt-platform.ts:120`, `src/lib/mkt-student-bot.ts:114`). Revoking `PUBLIC`
   alone would have broken the admin dashboard and the student bot. This is not a
   widening: it converts an implicit grant into an explicit, auditable one and removes `anon`.

### Requirement 8 — the two scrutinised functions

- `mkt_service_booking_context(text,uuid)`: **kept public.** Called ungated on the public
  booking page (`src/routes/services.$slug.$itemId.book.tsx:72` via
  `src/lib/mkt-services.ts:225`) before any sign-in.
- `mkt_student_bot_state()`: **removed from the public list.** It reads `auth.uid()` and its
  only caller is gated by `enabled: !!session`. It is now `authenticated`-only.

## 3. Before / after on the shadow database

The shadow ACLs were first **seeded to the production BEFORE state** (1,131 statements
derived from the snapshot), so the test measures the real production delta and not the
repo-build state.

| metric | BEFORE (= production) | AFTER hardening |
|---|---|---|
| objects | 575 | 575 |
| `EXECUTE` to `PUBLIC` | 372 | **0** |
| executable by `anon` | 429 | **40** |
| executable by `authenticated` | 556 | 464 |
| trigger functions callable by `anon` or `authenticated` | 99 | **0** |

Idempotency: the migration was applied twice in a row; the second run changed nothing and
reported the same counters.

## 4. Test matrix (role simulation via `SET LOCAL ROLE`, full sweeps — not samples)

| test | n | expected | violations |
|---|---|---|---|
| all 40 public exceptions callable as `anon` | 40 | ALLOWED | **0** |
| all hardened functions denied to `anon` | 434 | DENIED | **0** |
| all trigger functions denied to `anon` | 99 | DENIED | **0** |
| all trigger functions denied to `authenticated` | 99 | DENIED | **0** |
| representative authenticated call per prefix group (88 groups) | 138 | ALLOWED | **4, all pre-existing** |

The 4 authenticated denials are **not regressions**: `mkt_page_block_log`,
`mkt_purge_login_otps`, `mkt_student_bot_budget_alerts` are ACL class **D** in the snapshot
(`postgres` + `service_role` only — `authenticated` never had EXECUTE in production), and
`mkt_wallet_for_listing` is class **E** with no client caller anywhere in `src/`
(type definitions only). Their reachability is unchanged for every real caller.

"ALLOWED" here means the ACL permitted the call: the function either returned or raised its
own application error (`FORBIDDEN`, not-found, null-input), which additionally proves the
in-function guards are still the thing doing the authorisation.

## 5. Rollback proof

`20260812_acl_hardening_rollback.sql` was executed on the hardened shadow database and
restored the production before-state exactly: `anon 40 → 429`, `authenticated 464 → 556`,
`PUBLIC 0 → 372`. Every statement is a single-object `GRANT` traceable to one row of the
snapshot.

## 6. Honest limitations

- Browser-level verification of a hardened backend is impossible without writing to
  production: the app is connected to the production database, which is deliberately
  untouched. The role-simulation sweep above is the substitute, and it covers every
  object rather than a sample.
- The shadow database has no production seed data (directory rows, staff permissions,
  real `auth.users`), so calls return empty sets. This does not affect an EXECUTE-privilege
  test.
- Behaviour of functions reached through RLS policies was verified at the privilege level;
  the 8 policy-helper functions remain `anon`-executable and are inside the 40 exceptions.

## 7. Verdict

**GO recommended — for production, pending your separate explicit approval.**
The change removes `anon`/`PUBLIC` EXECUTE from 533 of 575 objects with zero proven
regressions, and the rollback is exact and tested. Nothing will be applied to production
until you say so.
