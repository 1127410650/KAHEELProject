#!/usr/bin/env node
/**
 * KAHEEL structure guard — repository half.
 *
 * The database enforces table naming with an EVENT TRIGGER; this script enforces
 * the same rules in the source tree, where they are cheaper to catch: table
 * names in `.from("...")`, storage bucket names, and route roots.
 *
 * Rules live in docs/ARCHITECTURE_RULES.md. Widening an allowlist here means
 * documenting the reason there too.
 *
 *   npm run guard:structure
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const ROUTES = join(SRC, "routes");

/** Pre-existing platform tables that predate the mkt_ convention. */
const LEGACY_TABLES = new Set([
  "profiles",
  "tenants",
  "tenant_memberships",
  "tenant_invitations",
  "user_roles",
  "user_permissions",
  "audit_log",
  "login_attempts",
  "rate_events",
]);

const APPROVED_BUCKETS = new Set(["mkt-media", "mkt-chat"]);

/** Approved route roots under src/routes (files at the top level are public pages). */
const APPROVED_ROUTE_ROOTS = new Set([
  "api",
  "admin",
  "my",
  "business",
  "guides",
  "profiles",
  "listings",
  "stores",
]);

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs)$/;
const SKIP_DIRS = new Set(["node_modules", "dist", ".output", ".vite"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (CODE_EXT.test(entry)) out.push(full);
  }
  return out;
}

const problems = [];
const files = walk(SRC);

// ── 1) Table names ──────────────────────────────────────────────────────────
// Only string literals are checkable; dynamic `.from(variable)` is skipped by
// design — the database event trigger is the backstop for those.
const TABLE_RE = /\.from\(\s*["'`]([A-Za-z0-9_]+)["'`]/g;
const STORAGE_RE = /storage\s*\n?\s*\.from\(\s*["'`]([A-Za-z0-9_-]+)["'`]/g;
const seenTables = new Set();

for (const file of files) {
  const code = readFileSync(file, "utf8");
  const rel = relative(ROOT, file);

  const storageLiterals = new Set(
    [...code.matchAll(STORAGE_RE)].map((m) => m[1]),
  );

  for (const [, name] of code.matchAll(TABLE_RE)) {
    if (storageLiterals.has(name)) continue; // bucket, handled below
    seenTables.add(name);
    if (!name.startsWith("mkt_") && !LEGACY_TABLES.has(name)) {
      problems.push(
        `${rel}: table "${name}" is not approved — new public tables must be prefixed with mkt_.`,
      );
    }
  }

  // ── 2) Bucket names ───────────────────────────────────────────────────────
  for (const bucket of storageLiterals) {
    if (!APPROVED_BUCKETS.has(bucket)) {
      problems.push(
        `${rel}: storage bucket "${bucket}" is not approved — allowed: ${[...APPROVED_BUCKETS].join(", ")}.`,
      );
    }
  }
  // Bucket-looking literals declared as constants (e.g. `const B = "mkt-x"`).
  for (const [, value] of code.matchAll(
    /(?:BUCKET[A-Z_]*)\s*=\s*["'`]([A-Za-z0-9-]+)["'`]/g,
  )) {
    if (!APPROVED_BUCKETS.has(value)) {
      problems.push(
        `${rel}: bucket constant "${value}" is not approved — allowed: ${[...APPROVED_BUCKETS].join(", ")}.`,
      );
    }
  }
}

// ── 3) Route roots ──────────────────────────────────────────────────────────
for (const entry of readdirSync(ROUTES)) {
  const full = join(ROUTES, entry);
  if (!statSync(full).isDirectory()) continue;
  if (entry.startsWith("_") || entry.startsWith("-")) continue; // layouts / helpers
  if (!APPROVED_ROUTE_ROOTS.has(entry)) {
    problems.push(
      `src/routes/${entry}${sep}: route root "${entry}" is not approved — allowed roots: ${[...APPROVED_ROUTE_ROOTS].join(", ")}.`,
    );
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
if (problems.length > 0) {
  console.error("KAHEEL structure guard: FAILED\n");
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error(
    `\nRules: docs/ARCHITECTURE_RULES.md — including how the project owner grants a documented exception.`,
  );
  process.exit(1);
}

console.log(
  `KAHEEL structure guard: OK — ${files.length} files, ${seenTables.size} table references, buckets limited to ${[...APPROVED_BUCKETS].join(", ")}.`,
);
