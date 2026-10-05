import { spawn } from "node:child_process";
import { realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "./build.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOG_PREFIX = "[sverigevistelseplanerare ios] ";

export async function stageIosWeb({ rootDir = repoRoot } = {}) {
  const sourceRoot = await realpath(resolve(rootDir));
  const outDir = join(sourceRoot, "native", "ios", "Web");
  await build({ rootDir: sourceRoot, outDir });
  return outDir;
}

export async function buildIos({ rootDir = repoRoot, catalyst = false } = {}) {
  const sourceRoot = await realpath(resolve(rootDir));
  await stageIosWeb({ rootDir: sourceRoot });
  const nativeRoot = join(sourceRoot, "native", "ios");
  const args = [
    "-project", join(nativeRoot, "Sverigevistelseplaneraren.xcodeproj"),
    "-scheme", "Sverigevistelseplaneraren",
    "-configuration", "Debug",
    "-sdk", catalyst ? "macosx" : "iphonesimulator",
    "-destination", catalyst ? "generic/platform=macOS,variant=Mac Catalyst" : "generic/platform=iOS Simulator",
    "-derivedDataPath", join(nativeRoot, catalyst ? "build-catalyst" : "build"),
    "CODE_SIGNING_ALLOWED=NO",
    "build"
  ];

  await new Promise((resolveBuild, rejectBuild) => {
    const child = spawn("xcodebuild", args, { stdio: "inherit" });
    child.on("error", () => rejectBuild(new Error(
      LOG_PREFIX + "Xcode kunde inte startas. Installera fullständigt Xcode och välj det med xcode-select."
    )));
    child.on("close", (code) => {
      if (code === 0) resolveBuild();
      else rejectBuild(new Error(LOG_PREFIX + "iOS-bygget misslyckades. Läs Xcode-felet ovan."));
    });
  });
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  const run = process.argv.includes("--stage-only") ? stageIosWeb : buildIos;
  run({ catalyst: process.argv.includes("--catalyst") }).catch((error) => {
    console.error(error instanceof Error ? error.message : LOG_PREFIX + "iOS-bygget misslyckades.");
    process.exitCode = 1;
  });
}
