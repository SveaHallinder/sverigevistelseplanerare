import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const LOG_PREFIX = "[sverigevistelseplanerare lint] ";
const root = resolve(".");
const scanRoots = ["src", "scripts", "test"];

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  }));
  return nested.flat();
}

function report(message) {
  process.stderr.write(LOG_PREFIX + message + "\n");
}

async function lint() {
  let failed = false;
  const packagePath = join(root, "package.json");

  try {
    JSON.parse(await readFile(packagePath, "utf8"));
  } catch (error) {
    report("Ogiltig package.json: " + error.message);
    failed = true;
  }

  const files = (await Promise.all(
    scanRoots.map((directory) => filesBelow(join(root, directory)))
  )).flat();
  const scripts = files.filter((path) => [".js", ".mjs"].includes(extname(path)));

  for (const path of scripts) {
    const checked = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
    if (checked.status !== 0) {
      report("Syntaxfel i " + relative(root, path) + ":");
      process.stderr.write(checked.stderr || checked.stdout || "Okänt syntaxfel.\n");
      failed = true;
    }

    const text = await readFile(path, "utf8");
    if (path.startsWith(join(root, "src")) && /\bconsole\s*\./.test(text)) {
      report("Console-anrop är inte tillåtna i src: " + relative(root, path));
      failed = true;
    }
  }

  const textFiles = [
    ...scripts,
    join(root, "index.html"),
    join(root, "styles.css"),
    packagePath
  ];

  for (const path of textFiles) {
    if (/[ \t]+$/m.test(await readFile(path, "utf8"))) {
      report("Trailing whitespace: " + relative(root, path));
      failed = true;
    }
  }

  if (failed) {
    process.exitCode = 1;
  }
}

lint().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  report(message);
  process.exitCode = 1;
});
