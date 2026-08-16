import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "../scripts/build.mjs";
import { createStaticServer } from "../scripts/serve.mjs";

const lintPath = fileURLToPath(new URL("../scripts/lint.mjs", import.meta.url));

async function createLintRoot(context) {
  const rootDir = await mkdtemp(join(tmpdir(), "sv-plan-lint-"));
  context.after(() => rm(rootDir, { recursive: true, force: true }));
  await Promise.all([
    mkdir(join(rootDir, "src")),
    mkdir(join(rootDir, "scripts")),
    mkdir(join(rootDir, "test"))
  ]);
  await Promise.all([
    writeFile(join(rootDir, "index.html"), "<main>ok</main>\n"),
    writeFile(join(rootDir, "styles.css"), "body {}\n"),
    writeFile(join(rootDir, "package.json"), "{}\n")
  ]);
  return rootDir;
}

function runLint(rootDir) {
  return spawnSync(process.execPath, [lintPath], {
    cwd: rootDir,
    encoding: "utf8"
  });
}

test("build copies only public application files", async (context) => {
  const rootDir = await mkdtemp(join(tmpdir(), "sv-plan-root-"));
  const outDir = await mkdtemp(join(tmpdir(), "sv-plan-out-"));
  context.after(() => Promise.all([
    rm(rootDir, { recursive: true, force: true }),
    rm(outDir, { recursive: true, force: true })
  ]));
  await Promise.all([
    mkdir(join(rootDir, "src")),
    mkdir(join(rootDir, "docs")),
    mkdir(join(rootDir, "test")),
    mkdir(join(rootDir, ".git")),
    mkdir(join(rootDir, "mockups"))
  ]);
  await writeFile(join(rootDir, "index.html"), "<main>app</main>");
  await writeFile(join(rootDir, "styles.css"), "body{}");
  await writeFile(join(rootDir, "src", "main.js"), "export const ready = true;");
  await writeFile(join(rootDir, "secret.txt"), "never copy");
  await Promise.all([
    writeFile(join(rootDir, "docs", "notes.md"), "private docs"),
    writeFile(join(rootDir, "test", "app.test.js"), "private tests"),
    writeFile(join(rootDir, ".git", "config"), "private git data"),
    writeFile(join(rootDir, "mockups", "stored.html"), "private mockup")
  ]);

  await build({ rootDir, outDir });

  assert.equal(await readFile(join(outDir, "index.html"), "utf8"), "<main>app</main>");
  assert.equal(await readFile(join(outDir, "styles.css"), "utf8"), "body{}");
  assert.equal(
    await readFile(join(outDir, "src", "main.js"), "utf8"),
    "export const ready = true;"
  );
  await assert.rejects(readFile(join(outDir, "secret.txt"), "utf8"), { code: "ENOENT" });
  for (const privatePath of [
    join("docs", "notes.md"),
    join("test", "app.test.js"),
    join(".git", "config"),
    join("mockups", "stored.html")
  ]) {
    await assert.rejects(readFile(join(outDir, privatePath), "utf8"), { code: "ENOENT" });
  }
});

test("build rejects output directories that contain the source root", async (context) => {
  const parentDir = await mkdtemp(join(tmpdir(), "sv-plan-parent-"));
  const rootDir = join(parentDir, "source");
  context.after(() => rm(parentDir, { recursive: true, force: true }));
  await mkdir(rootDir);
  await writeFile(join(rootDir, "index.html"), "<main>keep me</main>");

  await assert.rejects(
    build({ rootDir, outDir: parentDir }),
    { message: "[sverigevistelseplanerare build] Osäkert mål för build." }
  );
  assert.equal(
    await readFile(join(rootDir, "index.html"), "utf8"),
    "<main>keep me</main>"
  );
});

test("build rejects symlinked output paths that resolve into source files", async (context) => {
  const parentDir = await mkdtemp(join(tmpdir(), "sv-plan-build-symlink-"));
  const rootDir = join(parentDir, "source");
  const aliasDir = join(parentDir, "source-alias");
  const sourceScript = join(rootDir, "src", "main.js");
  context.after(() => rm(parentDir, { recursive: true, force: true }));
  await mkdir(join(rootDir, "src"), { recursive: true });
  await writeFile(join(rootDir, "index.html"), "<main>keep me</main>");
  await writeFile(join(rootDir, "styles.css"), "body{}");
  await writeFile(sourceScript, "export const untouched = true;");

  try {
    await symlink(rootDir, aliasDir, "dir");
  } catch (error) {
    if (["EACCES", "ENOSYS", "EPERM"].includes(error?.code)) {
      context.skip("Symlänkar stöds inte på plattformen: " + error.code);
      return;
    }
    throw error;
  }

  await assert.rejects(
    build({ rootDir, outDir: join(aliasDir, "src") }),
    { message: "[sverigevistelseplanerare build] Osäkert mål för build." }
  );
  assert.equal(await readFile(sourceScript, "utf8"), "export const untouched = true;");
});

test("server serves index and rejects dotfiles", async (context) => {
  const rootDir = await mkdtemp(join(tmpdir(), "sv-plan-serve-"));
  context.after(() => rm(rootDir, { recursive: true, force: true }));
  await mkdir(join(rootDir, "src"));
  await writeFile(join(rootDir, "index.html"), "<main>ok</main>");
  await writeFile(join(rootDir, "styles.css"), "body{}");
  await writeFile(join(rootDir, "src", "main.js"), "export const ready = true;");
  await writeFile(join(rootDir, ".hidden"), "secret");
  const server = createStaticServer(rootDir);
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const base = "http://127.0.0.1:" + address.port;

  const indexResponse = await fetch(base + "/");
  const styleResponse = await fetch(base + "/styles.css");
  const scriptResponse = await fetch(base + "/src/main.js");
  assert.equal(indexResponse.status, 200);
  assert.equal(indexResponse.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(styleResponse.headers.get("content-type"), "text/css; charset=utf-8");
  assert.equal(scriptResponse.headers.get("content-type"), "text/javascript; charset=utf-8");
  assert.equal(indexResponse.headers.get("cache-control"), "no-store");
  assert.equal(styleResponse.headers.get("cache-control"), "no-store");
  assert.equal(scriptResponse.headers.get("cache-control"), "no-store");
  assert.equal((await fetch(base + "/.hidden")).status, 404);
  assert.equal((await fetch(base + "/missing.js")).status, 404);
  assert.equal((await fetch(base + "/%2e%2e%2fpackage.json")).status, 404);
});

test("index exposes the required Swedish accessible application landmarks", async () => {
  const html = await readFile(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");

  assert.match(html, /<html\s+lang="sv">/);
  assert.match(html, /<meta\s+name="viewport"\s+content="[^"]+">/);
  assert.match(html, /<main\b[^>]*>/);
  assert.match(html, /<[^>]+\bid="live-region"[^>]+\baria-live="polite"[^>]*>/);
  assert.match(html, /<dialog\b[^>]*>/);
  assert.match(html, /<noscript\b[^>]*>/);
});

test("server rejects symlinks that escape the public root", async (context) => {
  const rootDir = await mkdtemp(join(tmpdir(), "sv-plan-symlink-root-"));
  const outsideDir = await mkdtemp(join(tmpdir(), "sv-plan-symlink-outside-"));
  context.after(() => Promise.all([
    rm(rootDir, { recursive: true, force: true }),
    rm(outsideDir, { recursive: true, force: true })
  ]));
  await mkdir(join(rootDir, "src"));
  const secretPath = join(outsideDir, "secret.js");
  await writeFile(secretPath, "secret outside content");

  try {
    await symlink(secretPath, join(rootDir, "src", "linked.js"));
  } catch (error) {
    if (["EACCES", "ENOSYS", "EPERM"].includes(error?.code)) {
      context.skip("Symlänkar stöds inte på plattformen: " + error.code);
      return;
    }
    throw error;
  }

  const server = createStaticServer(rootDir);
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const response = await fetch("http://127.0.0.1:" + address.port + "/src/linked.js");
  const body = await response.text();

  assert.deepEqual({ status: response.status, body }, { status: 404, body: "Not found" });
});

test("server rejects symlinks to non-public files inside the root", async (context) => {
  const rootDir = await mkdtemp(join(tmpdir(), "sv-plan-private-symlink-"));
  context.after(() => rm(rootDir, { recursive: true, force: true }));
  await mkdir(join(rootDir, "src"));
  const envPath = join(rootDir, ".env");
  const packagePath = join(rootDir, "package.json");
  await writeFile(envPath, "PRIVATE_TOKEN=do-not-leak");
  await writeFile(packagePath, "{\"private\":\"package content\"}");

  try {
    await symlink(envPath, join(rootDir, "src", "config.js"));
    await symlink(packagePath, join(rootDir, "src", "package.js"));
  } catch (error) {
    if (["EACCES", "ENOSYS", "EPERM"].includes(error?.code)) {
      context.skip("Symlänkar stöds inte på plattformen: " + error.code);
      return;
    }
    throw error;
  }

  const server = createStaticServer(rootDir);
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const base = "http://127.0.0.1:" + address.port;
  const results = await Promise.all(["/src/config.js", "/src/package.js"].map(async (path) => {
    const response = await fetch(base + path);
    return { status: response.status, body: await response.text() };
  }));

  assert.deepEqual(results, [
    { status: 404, body: "Not found" },
    { status: 404, body: "Not found" }
  ]);
});

test("lint rejects trailing whitespace in non-JavaScript files", async (context) => {
  const rootDir = await createLintRoot(context);
  await writeFile(join(rootDir, "test", "notes.txt"), "trailing whitespace  \n");

  const result = runLint(rootDir);

  assert.notEqual(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stderr, /Trailing whitespace: .*notes\.txt/);
});

test("lint syntax-checks every JavaScript file below src", async (context) => {
  const rootDir = await createLintRoot(context);
  await mkdir(join(rootDir, "src", "nested"));
  const brokenPath = join(rootDir, "src", "nested", "broken.js");
  await writeFile(brokenPath, "const answer = ;\n");

  const directResult = spawnSync(process.execPath, ["--check", brokenPath], {
    encoding: "utf8"
  });
  assert.notEqual(directResult.status, 0, "Testfixturen måste innehålla ogiltig JavaScript.");

  const result = runLint(rootDir);

  assert.notEqual(result.status, 0, result.stderr || result.stdout);
  assert.match(
    result.stderr,
    /\[sverigevistelseplanerare lint\] Syntaxfel i src\/nested\/broken\.js/
  );
});

test("lint ignores console text in comments and strings but rejects console calls", async (context) => {
  const rootDir = await createLintRoot(context);
  await writeFile(join(rootDir, "src", "safe.js"), [
    "// console.log('bara en kommentar')",
    "export const quoted = \"console.error('bara text')\";",
    "export const template = `console.warn('bara malltext')`;",
    ""
  ].join("\n"));

  const safeResult = runLint(rootDir);

  assert.equal(safeResult.status, 0, safeResult.stderr);

  await writeFile(join(rootDir, "src", "unsafe.js"), "console.info('anrop');\n");
  const unsafeResult = runLint(rootDir);

  assert.notEqual(unsafeResult.status, 0);
  assert.match(
    unsafeResult.stderr,
    /\[sverigevistelseplanerare lint\] Console-anrop är inte tillåtna i src: src\/unsafe\.js/
  );
});

test("lint finds console calls after postfix increments without confusing division and regex", async (context) => {
  const rootDir = await createLintRoot(context);
  await writeFile(join(rootDir, "src", "safe.js"), [
    "export const pattern = /console\\.log\\('bara regex'\\)/;",
    "export const quotient = 8 / 2;",
    "export const quoted = \"console.log('bara text')\";",
    "export const template = `console.log('bara malltext')`;",
    "// console.log('bara en kommentar')",
    ""
  ].join("\n"));

  const safeResult = runLint(rootDir);

  assert.equal(safeResult.status, 0, safeResult.stderr);

  await Promise.all([
    writeFile(join(rootDir, "src", "postfix-increment.js"), [
      "let value = 8;",
      "value++ / 2;",
      "console.log('anrop efter increment');",
      ""
    ].join("\n")),
    writeFile(join(rootDir, "src", "postfix-decrement.js"), [
      "let value = 8;",
      "value-- / 2;",
      "console.log('anrop efter decrement');",
      ""
    ].join("\n"))
  ]);

  const unsafeResult = runLint(rootDir);

  assert.notEqual(unsafeResult.status, 0);
  assert.match(unsafeResult.stderr, /src\/postfix-increment\.js/);
  assert.match(unsafeResult.stderr, /src\/postfix-decrement\.js/);
});

test("lint rejects optional and computed console calls", async (context) => {
  const rootDir = await createLintRoot(context);
  await Promise.all([
    writeFile(join(rootDir, "src", "optional.js"), "console?.info('anrop');\n"),
    writeFile(join(rootDir, "src", "computed.js"), "console['warn']('anrop');\n"),
    writeFile(
      join(rootDir, "src", "optional-computed.js"),
      "console?.['warn']('anrop');\n"
    )
  ]);

  const result = runLint(rootDir);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /src\/computed\.js/);
  assert.match(result.stderr, /src\/optional\.js/);
  assert.match(result.stderr, /src\/optional-computed\.js/);
});

test("lint requires noreferrer on external links", async (context) => {
  const rootDir = await createLintRoot(context);
  await writeFile(
    join(rootDir, "index.html"),
    '<a href="https://example.com" rel="noopener">Extern</a>\n'
  );

  const unsafeResult = runLint(rootDir);

  assert.notEqual(unsafeResult.status, 0);
  assert.match(
    unsafeResult.stderr,
    /\[sverigevistelseplanerare lint\] Extern länk saknar rel="noreferrer": index\.html/
  );

  await writeFile(
    join(rootDir, "index.html"),
    '<a href="https://example.com" rel="noopener noreferrer">Extern</a>\n'
  );
  const safeResult = runLint(rootDir);

  assert.equal(safeResult.status, 0, safeResult.stderr);
});

test("lint requires noreferrer on runtime links in source files", async (context) => {
  const rootDir = await createLintRoot(context);
  await writeFile(join(rootDir, "src", "link.js"), [
    "// '<a href=\"https://comment.example\" target=\"_blank\">Kommentar</a>'",
    "export const note = true; // '<a target=\"_blank\">Inline-kommentar</a>'",
    "/* '<a target=\"_blank\">Blockkommentar</a>' */",
    "export function link(url) {",
    "  return '<a href=\"' + url +",
    "    '\" target=\"_blank\" rel=\"noopener\">Extern</a>';",
    "}",
    ""
  ].join("\n"));

  const unsafeResult = runLint(rootDir);

  assert.notEqual(unsafeResult.status, 0);
  assert.match(
    unsafeResult.stderr,
    /\[sverigevistelseplanerare lint\] Extern länk saknar rel="noreferrer": src\/link\.js/
  );

  await writeFile(join(rootDir, "src", "link.js"), [
    "// '<a href=\"https://comment.example\" target=\"_blank\">Kommentar</a>'",
    "export const note = true; // '<a target=\"_blank\">Inline-kommentar</a>'",
    "/* '<a target=\"_blank\">Blockkommentar</a>' */",
    "export function link(url) {",
    "  return '<a href=\"' + url +",
    "    '\" target=\"_blank\" rel=\"noopener noreferrer\">Extern</a>';",
    "}",
    ""
  ].join("\n"));

  const safeResult = runLint(rootDir);

  assert.equal(safeResult.status, 0, safeResult.stderr);
});

test("lint policy covers the runtime source-link shape used by observations", async (context) => {
  const rootDir = await createLintRoot(context);
  const source = await readFile(
    fileURLToPath(new URL("../src/ui/observations.js", import.meta.url)),
    "utf8"
  );
  const unsafeSource = source.replace(
    'rel="noopener noreferrer"',
    'rel="noopener"'
  );
  assert.notEqual(unsafeSource, source, "Fixturen måste mutera observationslänkens rel-attribut.");
  await mkdir(join(rootDir, "src", "ui"));
  await writeFile(join(rootDir, "src", "ui", "observations.js"), source);

  const safeResult = runLint(rootDir);

  assert.equal(safeResult.status, 0, safeResult.stderr);

  await writeFile(join(rootDir, "src", "ui", "observations.js"), unsafeSource);
  const unsafeResult = runLint(rootDir);

  assert.notEqual(unsafeResult.status, 0);
  assert.match(unsafeResult.stderr, /src\/ui\/observations\.js/);
});
