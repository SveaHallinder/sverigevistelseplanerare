import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { stageIosWeb } from "../scripts/build-ios.mjs";

async function createSource(context) {
  const rootDir = await mkdtemp(join(tmpdir(), "sv-plan-ios-"));
  context.after(() => rm(rootDir, { recursive: true, force: true }));
  await mkdir(join(rootDir, "src"));
  await mkdir(join(rootDir, "native", "ios"), { recursive: true });
  await writeFile(join(rootDir, "index.html"), '<script type="module" src="src/main.js"></script>');
  await writeFile(join(rootDir, "styles.css"), "body {}\n");
  await writeFile(join(rootDir, "src", "main.js"), "export const app = true;\n");
  await writeFile(join(rootDir, "private.json"), '{"private":"do not bundle"}');
  await writeFile(join(rootDir, "native", "ios", "project.txt"), "keep native source\n");
  return realpath(rootDir);
}

test("iOS staging bundles only public web files and preserves native source", async (context) => {
  const rootDir = await createSource(context);
  const outDir = await stageIosWeb({ rootDir });

  assert.equal(outDir, join(rootDir, "native", "ios", "Web"));
  assert.deepEqual((await readdir(outDir)).sort(), ["index.html", "src", "styles.css"]);
  assert.equal(await readFile(join(outDir, "src", "main.js"), "utf8"), "export const app = true;\n");
  assert.equal(await readFile(join(rootDir, "native", "ios", "project.txt"), "utf8"), "keep native source\n");
  await assert.rejects(readFile(join(outDir, "private.json")), { code: "ENOENT" });
});

test("iOS staging replaces stale public assets without changing the input", async (context) => {
  const rootDir = await createSource(context);
  const outDir = await stageIosWeb({ rootDir });
  await writeFile(join(outDir, "stale.txt"), "remove only generated file");
  await writeFile(join(rootDir, "src", "main.js"), "export const app = 2;\n");

  await stageIosWeb({ rootDir });

  await assert.rejects(readFile(join(outDir, "stale.txt")), { code: "ENOENT" });
  assert.equal(await readFile(join(outDir, "src", "main.js"), "utf8"), "export const app = 2;\n");
  assert.equal(await readFile(join(rootDir, "src", "main.js"), "utf8"), "export const app = 2;\n");
});

test("iOS staging rejects a generated folder symlink into web source", async (context) => {
  const rootDir = await createSource(context);
  await symlink(join(rootDir, "src"), join(rootDir, "native", "ios", "Web"), "dir");

  await assert.rejects(stageIosWeb({ rootDir }), {
    message: "[sverigevistelseplanerare build] Osäkert mål för build."
  });
  assert.equal(await readFile(join(rootDir, "src", "main.js"), "utf8"), "export const app = true;\n");
});

test("native file and resource boundaries hold with the installed Swift compiler", async (context) => {
  if (process.platform !== "darwin" || spawnSync("xcrun", ["--find", "swiftc"]).status !== 0) {
    context.skip("Nativekontroller körs på macOS med Xcode; webbverktyget kräver inte Xcode.");
    return;
  }
  const outputDir = await mkdtemp(join(tmpdir(), "sv-plan-native-checks-"));
  context.after(() => rm(outputDir, { recursive: true, force: true }));
  const executable = join(outputDir, "native-checks");
  const compile = spawnSync("xcrun", [
    "swiftc",
    fileURLToPath(new URL("../native/ios/Sverigevistelseplaneraren/NativeSafety.swift", import.meta.url)),
    fileURLToPath(new URL("../native/ios/Tests/NativeSafetyChecks.swift", import.meta.url)),
    "-o", executable
  ], { encoding: "utf8" });
  assert.equal(compile.status, 0, compile.stderr || compile.error?.message);
  const checked = spawnSync(executable, [], { encoding: "utf8" });
  assert.equal(checked.status, 0, checked.stderr || checked.error?.message);
});
