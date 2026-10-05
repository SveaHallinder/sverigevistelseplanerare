import assert from "node:assert/strict";
import test from "node:test";
import { MAX_IMPORT_BYTES } from "../src/data-transfer.js";

const { createNativeFileBridge } = await import("../src/native-files.js").catch(() => ({}));

function nativeWindow(reply) {
  const calls = [];
  const handler = {
    async postMessage(message) {
      assert.equal(this, handler);
      calls.push(message);
      return typeof reply === "function" ? reply(message) : reply;
    }
  };
  return { calls, windowRef: { webkit: { messageHandlers: { sverigeNative: handler } } } };
}

test("native file bridge is optional and handles denied property access", () => {
  assert.equal(typeof createNativeFileBridge, "function");
  assert.equal(createNativeFileBridge({}), null);
  assert.equal(createNativeFileBridge({ get webkit() { throw new Error("denied"); } }), null);
});

test("native import exposes a file to the existing backup validator", async () => {
  const { calls, windowRef } = nativeWindow({
    ok: true, file: { name: "backup.json", size: 15, content: '{"version":1}' }
  });
  const file = await createNativeFileBridge(windowRef).chooseBackupFile();
  assert.deepEqual(calls, [{ action: "import" }]);
  assert.equal(file.name, "backup.json");
  assert.equal(file.size, 15);
  assert.equal(await file.text(), '{"version":1}');
});

test("native import cancellation returns no file", async () => {
  const { windowRef } = nativeWindow({ ok: false, cancelled: true });
  assert.equal(await createNativeFileBridge(windowRef).chooseBackupFile(), null);
});

test("native import rejects oversized files before parsing", async () => {
  for (const reply of [
    { ok: false, error: "oversized" },
    { ok: true, file: { name: "large.json", size: MAX_IMPORT_BYTES + 1, content: "{}" } },
    { ok: true, file: { name: "large.json", size: 1, content: "x".repeat(MAX_IMPORT_BYTES + 1) } }
  ]) {
    const { windowRef } = nativeWindow(reply);
    await assert.rejects(createNativeFileBridge(windowRef).chooseBackupFile(), { code: "oversized" });
  }
});

test("native import reports malformed responses without exposing file contents", async () => {
  for (const reply of [null, {}, { ok: true }, { ok: true, file: { name: "secret.json", size: -1, content: "private" } }]) {
    const { windowRef } = nativeWindow(reply);
    await assert.rejects(createNativeFileBridge(windowRef).chooseBackupFile(), {
      message: "Backupfilen kunde inte läsas. Ingen data har ändrats."
    });
  }
});

test("native export reports completion only after a completed Files export", async () => {
  let resolve;
  const reply = new Promise((done) => { resolve = done; });
  const { calls, windowRef } = nativeWindow(() => reply);
  const file = { filename: "backup.json", mimeType: "application/json", content: "{}" };
  let completed = false;
  const exporting = createNativeFileBridge(windowRef).downloadFile(file).then((result) => {
    completed = true;
    return result;
  });
  assert.equal(completed, false);
  assert.deepEqual(calls, [{ action: "export", file }]);
  resolve({ ok: true });
  assert.deepEqual(await exporting, { message: "Filen har exporterats." });
});

test("native export cancellation and failure never report success", async () => {
  const file = { filename: "backup.json", mimeType: "application/json", content: "{}" };
  const cancelled = nativeWindow({ ok: false, cancelled: true });
  assert.deepEqual(await createNativeFileBridge(cancelled.windowRef).downloadFile(file), { cancelled: true });
  for (const reply of [null, {}, { ok: false, error: "export-failed" }]) {
    const { windowRef } = nativeWindow(reply);
    await assert.rejects(createNativeFileBridge(windowRef).downloadFile(file), {
      message: "Filen kunde inte exporteras."
    });
  }
});
