<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Canonical infrastructure (mandatory)

- The only approved GitHub source is `1127410650/KAHEELProject` (repository ID `1318292196`).
- The only approved Supabase project is `KAHEELProject` (ref `rgpnhzovtceitqxpiilf`).
- Never create, fork, mirror, import, initialize, or adopt another repository, project copy, Supabase project, Storage bucket, or infrastructure container for this product.
- Do not use data, images, assets, or content from outside this project.
- The automatic canonical guard is paused by the project owner from 2026-08-09 until the owner explicitly requests reactivation after the website design is complete.
- Keep `npm run guard:canonical`, its scripts, and its GitHub workflow intact but dormant. Do not call the guard automatically from development, build, preview, seed, restore, CI, deployment, migration, or remote-write flows while the pause is active.
- Enforce the canonical repository, Supabase project, and no-duplication requirements directly as project instructions while the automatic guard is paused. Stop on any mismatch; never repair a mismatch by creating new infrastructure.
- Keep Vercel, Lovable, CI, local tooling, and future automation connected to the approved repository and Supabase ref only.
- Retired repository names and retired Supabase refs must never be restored to runtime configuration.
