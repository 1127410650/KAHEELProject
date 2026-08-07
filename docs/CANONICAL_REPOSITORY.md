# KAHEEL canonical repository policy

The single canonical GitHub repository for the KAHEEL project is:

`1127410650/KAHEELProject`

Repository ID: `1318292196`
Default branch: `main`

The single canonical Supabase project is:

`KAHEEL Project` (`rgpnhzovtceitqxpiilf`)

## Policy

- All KAHEEL source code, branches, pull requests, CI workflows, release evidence, mobile work, security audits, and project maintenance must originate from this repository only.
- Do not create, mirror, fork, or maintain an alternative KAHEEL project repository as an active source of truth.
- Historical repository names or redirected GitHub URLs must not be used as repository identifiers in project automation or documentation.
- Do not create, clone as a new source of truth, mirror, fork, import, or adopt another GitHub repository or Supabase project for KAHEEL.
- Retired or alternate Supabase project references must not appear in runtime configuration or tracked source files.
- Runtime service domains such as Vercel or Supabase are not repository identifiers and are not changed by this policy unless separately approved.
- If any available repository evidence—local Git, GitHub Actions, another CI service, or Vercel—does not resolve to `1127410650/KAHEELProject` with repository ID `1318292196`, automation must fail closed.
- Vercel must report GitHub as the provider and the approved repository owner, slug, and numeric ID. A Vercel build without that Git evidence is rejected.
- Runtime Supabase URLs and project IDs must resolve to `rgpnhzovtceitqxpiilf`. Conflicting values in process variables or any root `.env*` file are rejected without printing keys.
- Real environment files and publishable keys stay outside Git; `.env.example` contains only the approved project identity and non-secret placeholders.
- Immutable historical backup records are evidence, not runtime configuration; the guard never treats them as a deployable project source.
- Package builds, development servers, previews, QA seeding, direct Vite commands, and the canonical GitHub workflow run the guard before execution.
- Lovable, Codex, CI, deployment tools, and future agents must not bypass, weaken, or remove these checks and must not create or adopt alternative repositories or Supabase projects.

Repository enforcement is implemented in `scripts/check-canonical-repository.mjs`.
Supabase enforcement is implemented in `scripts/check-canonical-infrastructure.mjs`.
Run both with `npm run guard:canonical`.
