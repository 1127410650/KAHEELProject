// Backward-compatible entrypoint. The complete fail-closed authority policy now
// validates the canonical GitHub repository, approved Supabase project, approved
// deployment identity, native application identifiers, and duplicate project roots.
import "./check-project-authority.mjs";
