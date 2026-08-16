import { cp, mkdir, realpath, rm } from "node:fs/promises";
import { basename, dirname, join, parse, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");

async function canonicalizePath(targetPath) {
  let existingPath = targetPath;
  const remainingParts = [];

  while (true) {
    try {
      return resolve(await realpath(existingPath), ...remainingParts);
    } catch (error) {
      if (!["ENOENT", "ENOTDIR"].includes(error?.code)) {
        throw error;
      }

      const nextParent = dirname(existingPath);
      if (nextParent === existingPath) {
        throw error;
      }
      remainingParts.unshift(basename(existingPath));
      existingPath = nextParent;
    }
  }
}

function pathsOverlap(firstPath, secondPath) {
  return firstPath === secondPath ||
    firstPath.startsWith(secondPath + sep) ||
    secondPath.startsWith(firstPath + sep);
}

export async function build({
  rootDir = repoRoot,
  outDir = join(repoRoot, "dist")
} = {}) {
  const sourceRoot = await realpath(resolve(rootDir));
  const outputRoot = resolve(outDir);
  const sourcePaths = await Promise.all([
    join(sourceRoot, "index.html"),
    join(sourceRoot, "styles.css"),
    join(sourceRoot, "src")
  ].map(canonicalizePath));
  const canonicalOutputRoot = await canonicalizePath(outputRoot);
  const outputContainsSourceRoot = sourceRoot === canonicalOutputRoot ||
    sourceRoot.startsWith(canonicalOutputRoot + sep);
  const overlapsSource = sourcePaths.some((sourcePath) =>
    pathsOverlap(sourcePath, canonicalOutputRoot)
  );

  if (canonicalOutputRoot === parse(canonicalOutputRoot).root ||
      outputContainsSourceRoot || overlapsSource) {
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
