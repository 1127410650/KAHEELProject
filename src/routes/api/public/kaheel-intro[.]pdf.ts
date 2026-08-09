import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Stable public address of the platform introduction PDF.
 *
 * The file lives in the approved `mkt-media` bucket under `public/`, which the
 * Data API exposes to `anon` via a narrow storage policy. This route hides the
 * key and the bucket path behind one immutable link that can be pasted into a
 * WhatsApp message: /api/public/kaheel-intro.pdf
 */
export const Route = createFileRoute("/api/public/kaheel-intro.pdf")({
  server: {
    handlers: {
      GET: async () => {
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key) return new Response("Not configured", { status: 503 });

        const client = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const headers = new Headers(init?.headers);
              if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
                headers.delete("Authorization");
              }
              headers.set("apikey", key);
              return fetch(input, { ...init, headers });
            },
          },
        });

        const { data, error } = await client.storage
          .from("mkt-media")
          .download("public/kaheel-intro.pdf");
        if (error || !data) return new Response("Not found", { status: 404 });

        return new Response(await data.arrayBuffer(), {
          headers: {
            "content-type": "application/pdf",
            "content-disposition": 'inline; filename="kaheel-intro.pdf"',
            "cache-control": "public, max-age=3600, s-maxage=86400",
          },
        });
      },
    },
  },
});
