import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
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

test("server serves index and rejects dotfiles", async (context) => {
  const rootDir = await mkdtemp(join(tmpdir(), "sv-plan-serve-"));
  context.after(() => rm(rootDir, { recursive: true, force: true }));
  await writeFile(join(rootDir, "index.html"), "<main>ok</main>");
  await writeFile(join(rootDir, ".hidden"), "secret");
  const server = createStaticServer(rootDir);
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const base = "http://127.0.0.1:" + address.port;

  assert.equal((await fetch(base + "/")).status, 200);
  assert.equal((await fetch(base + "/.hidden")).status, 404);
});
