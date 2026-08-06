import assert from "node:assert/strict";
import { validatedSupabaseUrl } from "../src/lib/supabase-url-policy.ts";

assert.equal(
  validatedSupabaseUrl("https://projectref.supabase.co", "projectref", false),
  "https://projectref.supabase.co",
);
assert.equal(
  validatedSupabaseUrl("https://projectref.supabase.co/rest/v1", "projectref", false),
  "https://projectref.supabase.co",
);
assert.equal(
  validatedSupabaseUrl("http://127.0.0.1:54321", undefined, true),
  "http://127.0.0.1:54321",
);

for (const [url, projectRef, development] of [
  ["http://projectref.supabase.co", "projectref", false],
  ["https://evil.example.com", "projectref", false],
  ["https://projectref.supabase.co.evil.example", "projectref", false],
  ["https://nested.projectref.supabase.co", "projectref", false],
  ["https://otherref.supabase.co", "projectref", false],
  ["https://u:p@projectref.supabase.co", "projectref", false],
  ["https://projectref.supabase.co:444", "projectref", false],
  ["http://192.168.1.20:54321", undefined, true],
]) {
  assert.throws(
    () => validatedSupabaseUrl(url, projectRef, development),
    undefined,
    `Expected rejection for ${url}`,
  );
}

console.log("Supabase URL policy tests passed.");
