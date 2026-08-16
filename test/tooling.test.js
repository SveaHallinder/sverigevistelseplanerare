import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "../scripts/build.mjs";
import { createStaticServer } from "../scripts/serve.mjs";

test("build copies only public application files", async (context) => {
  const rootDir = await mkdtemp(join(tmpdir(), "sv-plan-root-"));
  const outDir = await mkdtemp(join(tmpdir(), "sv-plan-out-"));
  context.after(() => Promise.all([
    rm(rootDir, { recursive: true, force: true }),
    rm(outDir, { recursive: true, force: true })
  ]));
  await mkdir(join(rootDir, "src"));
  await writeFile(join(rootDir, "index.html"), "<main>app</main>");
  await writeFile(join(rootDir, "styles.css"), "body{}");
  await writeFile(join(rootDir, "src", "main.js"), "export const ready = true;");
  await writeFile(join(rootDir, "secret.txt"), "never copy");

  await build({ rootDir, outDir });

  assert.equal(await readFile(join(outDir, "index.html"), "utf8"), "<main>app</main>");
  assert.equal(await readFile(join(outDir, "styles.css"), "utf8"), "body{}");
  assert.equal(
    await readFile(join(outDir, "src", "main.js"), "utf8"),
    "export const ready = true;"
  );
  await assert.rejects(readFile(join(outDir, "secret.txt"), "utf8"), { code: "ENOENT" });
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
    writeFile(join(rootDir, "package.json"), "{}\n"),
    writeFile(join(rootDir, "test", "notes.txt"), "trailing whitespace  \n")
  ]);
  const lintPath = fileURLToPath(new URL("../scripts/lint.mjs", import.meta.url));

  const result = spawnSync(process.execPath, [lintPath], {
    cwd: rootDir,
    encoding: "utf8"
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Trailing whitespace: .*notes\.txt/);
});
