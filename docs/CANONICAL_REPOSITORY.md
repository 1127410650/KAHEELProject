# KAHEEL canonical repository policy

The single canonical GitHub repository for the KAHEEL project is:

`1127410650/KAHEELProject`

Repository ID: `1318292196`
Default branch: `main`

## Policy

- All KAHEEL source code, branches, pull requests, CI workflows, release evidence, mobile work, security audits, and project maintenance must originate from this repository only.
- Do not create, mirror, fork, or maintain an alternative KAHEEL project repository as an active source of truth.
- Historical repository names or redirected GitHub URLs must not be used as repository identifiers in project automation or documentation.
- Runtime service domains such as Vercel or Supabase are not repository identifiers and are not changed by this policy unless separately approved.
- If a local checkout's `origin` or GitHub Actions' `GITHUB_REPOSITORY` does not resolve to `1127410650/KAHEELProject`, project automation must fail closed.

The enforcement script is `scripts/check-canonical-repository.mjs`.
