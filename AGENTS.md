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
- Never create, fork, mirror, import, initialize, or adopt another repository or Supabase project for this product.
- Never bypass, weaken, or remove `npm run guard:canonical`, its scripts, or its GitHub workflow.
- Before any build, preview, development server, seed, deployment, migration, or remote write, verify the canonical identifiers. Stop on any mismatch; do not repair a mismatch by creating new infrastructure.
- Keep Vercel, Lovable, CI, local tooling, and future automation connected to the approved repository and Supabase ref only.
- Retired repository names and retired Supabase refs must never be restored to runtime configuration.
