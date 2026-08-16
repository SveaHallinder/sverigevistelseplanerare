import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");

export async function build({
  rootDir = repoRoot,
  outDir = join(repoRoot, "dist")
} = {}) {
  const sourceRoot = resolve(rootDir);
  const outputRoot = resolve(outDir);

  if (outputRoot === sourceRoot || outputRoot === parse(outputRoot).root) {
    throw new Error("[sverigevistelseplanerare build] Osäkert mål för build.");
  }

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  await Promise.all([
    cp(join(sourceRoot, "index.html"), join(outputRoot, "index.html")),
    cp(join(sourceRoot, "styles.css"), join(outputRoot, "styles.css")),
    cp(join(sourceRoot, "src"), join(outputRoot, "src"), { recursive: true })
  ]);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";

if (invokedPath === import.meta.url) {
  build().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[sverigevistelseplanerare build] " + message);
    process.exitCode = 1;
  });
}
