import { existsSync, readFileSync } from "node:fs";

const findings = [];
const requireProjects = process.env.MOBILE_NATIVE_PROJECTS_REQUIRED === "1";

function report(file, reason) {
  findings.push(`${file}: ${reason}`);
}

function read(file) {
  return readFileSync(file, "utf8");
}

const androidManifestPath = "android/app/src/main/AndroidManifest.xml";
const androidVariablesPath = "android/variables.gradle";

if (requireProjects && !existsSync(androidManifestPath)) {
  report(androidManifestPath, "Android project is required but missing");
}
if (existsSync(androidManifestPath)) {
  if (!existsSync(androidVariablesPath)) {
    report(androidVariablesPath, "is missing the generated Android SDK baseline");
  } else {
    const variables = read(androidVariablesPath);
    const minSdk = variables.match(/minSdkVersion\s*=\s*(\d+)/)?.[1];
    if (!minSdk) {
      report(androidVariablesPath, "does not declare minSdkVersion");
    } else if (Number(minSdk) < 23) {
      report(androidVariablesPath, `minSdkVersion ${minSdk} is below the secure-storage baseline of 23`);
    }
  }

  const androidIndexPath = "android/app/src/main/assets/public/index.html";
  if (!existsSync(androidIndexPath)) {
    report(androidIndexPath, "does not contain the synchronized native SPA entry point");
  }
}

const iosInfoPath = "ios/App/App/Info.plist";
const iosProjectPath = "ios/App/App.xcodeproj/project.pbxproj";

if (requireProjects && !existsSync(iosInfoPath)) {
  report(iosInfoPath, "iOS project is required but missing");
}
if (existsSync(iosInfoPath)) {
  if (!existsSync(iosProjectPath)) {
    report(iosProjectPath, "is missing the generated iOS project settings");
  } else {
    const project = read(iosProjectPath);
    const deploymentTargets = [...project.matchAll(/IPHONEOS_DEPLOYMENT_TARGET\s*=\s*([0-9.]+);/g)].map(
      (match) => Number(match[1]),
    );
    if (deploymentTargets.length === 0) {
      report(iosProjectPath, "does not declare an iOS deployment target");
    } else if (deploymentTargets.some((version) => !Number.isFinite(version) || version < 14)) {
      report(iosProjectPath, "contains an iOS deployment target below 14.0");
    }
  }

  const iosIndexPath = "ios/App/App/public/index.html";
  if (!existsSync(iosIndexPath)) {
    report(iosIndexPath, "does not contain the synchronized native SPA entry point");
  }
}

if (findings.length > 0) {
  console.error("Native platform baseline check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Native platform baseline check passed.");
