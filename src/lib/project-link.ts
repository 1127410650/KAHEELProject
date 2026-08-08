import { z } from "zod";

const projectId = z.string().regex(/^[a-z0-9][a-z0-9-]{2,63}$/);

export const projectLinkManifestSchema = z
  .object({
    protocol: z.literal("kaheel-project-link/v1"),
    project_id: projectId,
    project_type: z.string().min(2).max(40),
    display_name: z.object({
      ar: z.string().min(1).max(100),
      en: z.string().min(1).max(100),
    }),
    discovery_path: z.literal("/.well-known/kaheel-project.json"),
    linking: z.object({
      direction: z.literal("bidirectional"),
      data_mode: z.literal("references-only"),
      authorization: z.literal("explicit"),
      status: z.enum(["foundation", "active", "paused"]),
    }),
    capabilities: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/)).max(30),
    security: z.object({
      auto_trust: z.literal(false),
      shared_database: z.literal(false),
      shared_service_role: z.literal(false),
      permission_inheritance: z.literal(false),
    }),
  })
  .strict();

export type ProjectLinkManifest = z.infer<typeof projectLinkManifestSchema>;

/**
 * Stable reference exchanged between projects. It is deliberately opaque:
 * e-mail, phone, commercial registration and local database ids are not a
 * cross-project authorization mechanism.
 */
export interface ExternalProjectReference {
  projectId: string;
  subjectRef: string;
  scopes: string[];
}

export function parseProjectLinkManifest(value: unknown): ProjectLinkManifest {
  return projectLinkManifestSchema.parse(value);
}

/** Resolve only the public discovery document; no credentials or cookies travel. */
export function projectManifestUrl(origin: string): URL {
  const url = new URL(origin);
  const localDevelopment =
    url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(localDevelopment && url.protocol === "http:")) {
    throw new Error("Project discovery requires HTTPS");
  }
  url.username = "";
  url.password = "";
  url.pathname = "/.well-known/kaheel-project.json";
  url.search = "";
  url.hash = "";
  return url;
}

export async function discoverProject(
  origin: string,
  signal?: AbortSignal,
): Promise<ProjectLinkManifest> {
  const response = await fetch(projectManifestUrl(origin), {
    method: "GET",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
    headers: { Accept: "application/json" },
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error(`Project discovery failed (${response.status})`);
  return parseProjectLinkManifest(await response.json());
}
