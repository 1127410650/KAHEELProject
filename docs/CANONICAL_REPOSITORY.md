# KAHEEL canonical project authority policy

The only approved GitHub repository for the KAHEEL project is:

`1127410650/KAHEELProject`

Repository ID: `1318292196`  
Default branch: `main`

The only approved Supabase project is:

- Project ref: `fdmovlxyqebtgzhsroac`
- Origin: `https://fdmovlxyqebtgzhsroac.supabase.co`
- Config: `supabase/config.toml`

The currently approved public deployment identity is:

- Origin: `https://check-your-name-ai.vercel.app`
- Vercel Git owner: `1127410650`
- Vercel Git repository: `KAHEELProject`

The reserved native application identifier is:

`com.kahli.marketplace`

## Fail-closed rules

- All source code, branches, pull requests, CI workflows, release evidence, mobile work, security audits, migrations, and maintenance originate from `1127410650/KAHEELProject` only.
- A local checkout may have exactly one Git remote named `origin`, and it must resolve to the canonical repository.
- Unknown CI/build platforms are blocked. GitHub Actions and Vercel must identify themselves as connected to the canonical repository.
- Vercel must report the approved production host; a duplicate Vercel project connected to another repository or production host is rejected.
- Exactly one Supabase config may exist, at `supabase/config.toml`, and every operational Supabase URL/project reference must resolve to the approved project.
- Client/build environments must never contain a Supabase service-role or secret key.
- A second browser Supabase client, nested package root, workspace, Git submodule, nested Capacitor config, or conflicting native application ID is rejected.
- Installation, development, build, preview, QA seeding, migration automation, signing, and publishing stop when the authority check fails.
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

The guard is also wired into npm lifecycle hooks before install, development, build, preview, and QA seeding. GitHub Actions runs the same check with read-only repository permissions.

No repository-side guard can stop an unrelated third party from manually creating a new repository or removing the guard from copied source. The enforceable protection is that an unchanged copy, unauthorized checkout, wrong Supabase project, wrong Vercel identity, or conflicting native ID fails before the project installs, builds, deploys, signs, or publishes.
