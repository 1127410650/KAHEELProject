import { readFileSync } from "node:fs";

const findings = [];

function requirePattern(file, content, pattern, reason) {
  if (!pattern.test(content)) findings.push(`${file}: ${reason}`);
}

const rootRoutePath = "src/routes/__root.tsx";
const rootRoute = readFileSync(rootRoutePath, "utf8");
for (const [pattern, reason] of [
  [/name:\s*"viewport"/, "does not define a viewport meta element"],
  [/width=device-width, initial-scale=1, viewport-fit=cover/, "does not enable safe-area viewport coverage"],
]) {
  requirePattern(rootRoutePath, rootRoute, pattern, reason);
}

const stylesPath = "src/styles.css";
const styles = readFileSync(stylesPath, "utf8");
for (const [pattern, reason] of [
  [/env\(safe-area-inset-bottom\)/, "does not reserve the device bottom safe area"],
  [/min-height:\s*92dvh|max-height:\s*92dvh/, "does not use dynamic viewport units for mobile sheets"],
]) {
  requirePattern(stylesPath, styles, pattern, reason);
}

const privacyStylesPath = "src/mobile-privacy.css";
const privacyStyles = readFileSync(privacyStylesPath, "utf8");
for (const [pattern, reason] of [
  [/env\(safe-area-inset-top\)/, "does not cover the top safe area in privacy mode"],
  [/env\(safe-area-inset-bottom\)/, "does not cover the bottom safe area in privacy mode"],
  [/height:\s*100dvh/, "does not use the dynamic viewport height"],
]) {
  requirePattern(privacyStylesPath, privacyStyles, pattern, reason);
}

if (findings.length > 0) {
  console.error("Mobile safe-area check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Mobile safe-area viewport and CSS checks passed.");
