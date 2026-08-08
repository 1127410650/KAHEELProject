import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const file of ["index.html", "app.js", "core.js", "demo-data.js", "styles.css"]) {
  await cp(resolve(root, file), resolve(dist, file));
}
await cp(resolve(root, "public"), dist, { recursive: true });
const html = await readFile(resolve(dist, "index.html"), "utf8");
if (!html.includes("/app.js") || !html.includes("/styles.css")) {
  throw new Error("Static entrypoint is incomplete");
}
console.log("Built standalone KAHEEL Appointments into dist/");
