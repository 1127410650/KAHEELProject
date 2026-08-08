import { access, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceEntry = join(root, "app.js");

async function sourceExists() {
  try {
    await access(sourceEntry);
    return true;
  } catch {
    return false;
  }
}

async function unpackSource() {
  if (await sourceExists()) return;
  const archiveDir = join(root, "archive");
  const parts = (await readdir(archiveDir)).filter((name) => name.startsWith("part-")).sort();
  if (!parts.length) throw new Error("Standalone source archive is missing");
  const encoded = (await Promise.all(parts.map((name) => readFile(join(archiveDir, name), "utf8")))).join("");
  const temp = await mkdtemp(join(tmpdir(), "kaheel-appointments-"));
  const archive = join(temp, "source.tar.gz");
  await writeFile(archive, Buffer.from(encoded, "base64"));
  execFileSync("tar", ["-xzf", archive, "-C", root], { stdio: "inherit" });
  await rm(temp, { recursive: true, force: true });
}

await unpackSource();
const command = process.argv[2] ?? "prepare";
if (command === "prepare") {
  console.log("KAHEEL Appointments standalone source is ready.");
} else if (command === "test") {
  const tests = (await readdir(join(root, "tests"))).filter((name) => name.endsWith(".test.js")).sort();
  execFileSync(process.execPath, ["--test", ...tests.map((name) => join("tests", name))], {
    cwd: root,
    stdio: "inherit",
  });
} else if (command === "build") {
  execFileSync(process.execPath, [join("scripts", "build.mjs")], { cwd: root, stdio: "inherit" });
} else {
  throw new Error(`Unknown bootstrap command: ${command}`);
}
