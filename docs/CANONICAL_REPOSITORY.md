# KAHEEL canonical project authority policy

The only approved GitHub repository for the KAHEEL project is:

`1127410650/KAHEELProject`

Repository ID: `1318292196`  
Default branch: `main`

The only approved Supabase project is:

- Project ref: `fdmovlxyqebtgzhsroac`
- Origin: `https://fdmovlxyqebtgzhsroac.supabase.co`
- Config: `supabase/config.toml`

The only approved Vercel deployment identity is:

- Project ID: `prj_OeJq9TShLOrJkHCMCtrX2uEJSLJV`
- Organization/Team ID: `team_5U6h5f6CWoHmohhpAyPir7P1`
- Production origin: `https://check-your-name-ai.vercel.app`
- Git provider: `github`
- Git owner: `1127410650`
- Git repository: `KAHEELProject`
- Git repository ID: `1318292196`

The reserved native application identifier is:

`com.kahli.marketplace`

## Fail-closed rules

- All source code, branches, pull requests, CI workflows, release evidence, mobile work, security audits, migrations, and maintenance originate from `1127410650/KAHEELProject` only.
- A local checkout may have exactly one Git remote named `origin`, and it must resolve to the canonical repository.
- Unknown CI/build platforms are blocked. GitHub Actions and Vercel must identify themselves as connected to the canonical repository.
- Vercel must report the approved Project ID, Git provider, Git owner, Git repository slug/ID, and production host. A duplicate Vercel project fails before the build.
- Vercel's **Automatically expose System Environment Variables** setting must remain enabled so the build can prove `VERCEL_PROJECT_ID`, `VERCEL_GIT_REPO_*`, and `VERCEL_PROJECT_PRODUCTION_URL`.
- Exactly one Supabase config may exist, at `supabase/config.toml`, and every operational Supabase URL/project reference must resolve to the approved project.
- Supabase service-role or secret material is forbidden in any `VITE_*`, `NEXT_PUBLIC_*`, or `PUBLIC_*` client-exposed variable. Server-only secrets are not copied into the client and are governed separately.
- A second browser Supabase client, nested package root, workspace, Git submodule, nested Capacitor config, or conflicting native application ID is rejected.
- Installation performs a static source-authority check. Development, build, preview, QA seeding, migration automation, signing, and publishing require the full runtime/platform identity check.
- Historical repository names and redirected GitHub URLs are not valid automation identities.

## Enforcement

The locked authority record is:

`.kaheel/project-authority.json`

The fail-closed checker is:

`scripts/check-project-authority.mjs`

Commands:

- `npm run authority:check`
- `npm run authority:check:runtime`
- `npm run repository:check` (backward-compatible alias)

The guard is wired into npm lifecycle hooks before install, development, build, preview, and QA seeding. GitHub Actions runs the same check with read-only repository permissions and includes negative tests proving that a foreign repository, foreign Supabase project, duplicate Vercel identity, and unknown CI platform are rejected.

No repository-side guard can stop an unrelated third party from manually creating a repository or removing the guard from copied source. The enforceable protection is that an unchanged copy, unauthorized checkout, wrong Supabase project, wrong Vercel identity, or conflicting native ID fails before the project builds, deploys, signs, or publishes.
