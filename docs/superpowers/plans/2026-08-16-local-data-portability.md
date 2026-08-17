# Local Data Portability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lossless canonical JSON backup/restore and deterministic private CSV stay export without changing AppState v1 or adding cloud infrastructure.

**Architecture:** One pure transfer module wraps the existing serializer, decoder and inclusive day arithmetic. The controller owns preview, confirmation, repository-mediated state replacement and explicit partial-write conflict reporting; the browser layer owns local file reading and download mechanics through injected helpers. Existing storage conflict semantics remain untouched and are characterized rather than described as transactional.

**Tech Stack:** Vanilla JavaScript ES modules, browser `File`, `Blob` and object URLs, Node.js 20+ built-ins and `node:test`. No dependency and no persisted schema change.

---

## Preconditions

- Complete and commit every checkbox in `2026-08-16-functional-hardening.md` first.
- Confirm `npm run check` is green and the worktree is clean.
- Read `src/storage.js`, `src/controller.js`, `src/main.js`, `src/ui/cockpit.js` and their neighbouring tests before editing.
- Never write imported data directly to `localStorage` or `sessionStorage`.

### Task 1: Add pure JSON and CSV codecs

**Files:**
- Create: `src/data-transfer.js`
- Create: `test/data-transfer.test.js`
- Reuse: `src/storage.js`
- Reuse: `src/domain/dates.js`

- [x] **Step 1: Write the missing-module contract test**

Create `test/data-transfer.test.js` with the project test helpers needed to build one valid AppState v1. Start with these contract assertions:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { CHECKLIST_KEYS } from "../src/domain/validation.js";

const transferApi = await import("../src/data-transfer.js").catch(() => ({}));
const {
  MAX_IMPORT_BYTES,
  createBackupJson,
  createStayCsv,
  parseBackupJson
} = transferApi;

function profile() {
  return {
    departureDate: "2025-02-15",
    budgetDays: 90,
    periodStart: "2026-01-01",
    periodEnd: "2026-12-31",
    swedishCitizen: "unanswered",
    livedInSwedenTenYears: "unanswered",
    connectionChecklist: Object.fromEntries(
      CHECKLIST_KEYS.map((key) => [key, "unanswered"])
    )
  };
}

function state(overrides = {}) {
  return {
    version: 1,
    profile: profile(),
    stays: overrides.stays ?? [{
      id: "stay-1",
      arrivalDate: "2026-08-01",
      departureDate: "2026-08-03",
      status: "actual",
      createdAt: "2026-07-01T12:00:00.000Z",
      updatedAt: "2026-07-01T12:00:00.000Z"
    }]
  };
}

test("data transfer exports only the locked API", () => {
  assert.deepEqual(Object.keys(transferApi).sort(), [
    "MAX_IMPORT_BYTES",
    "createBackupJson",
    "createStayCsv",
    "parseBackupJson"
  ]);
  assert.equal(MAX_IMPORT_BYTES, 1_048_576);
});

test("backup JSON is canonical AppState v1 and round-trips byte-identically", () => {
  const original = state();
  const created = createBackupJson(original);

  assert.equal(created.ok, true);
  assert.equal(created.value, JSON.stringify(original));
  const parsed = parseBackupJson(created.value);
  assert.deepEqual(parsed, { ok: true, value: original });
  assert.equal(createBackupJson(parsed.value).value, created.value);
});

test("backup parser maps unsafe inputs without echoing personal values", async (context) => {
  const cases = [
    ["invalid JSON", "{PRIVATE-DATE", "Backupfilen innehåller inte giltig JSON."],
    ["unsupported version", JSON.stringify({ version: 2 }), "Backupfilens version stöds inte."],
    ["invalid state", JSON.stringify({ version: 1, profile: null, stays: [{}] }), "Backupfilen har en ogiltig struktur."]
  ];

  for (const [name, raw, message] of cases) {
    await context.test(name, () => {
      const result = parseBackupJson(raw);
      assert.deepEqual(result, { ok: false, message });
      assert.doesNotMatch(result.message, /PRIVATE-DATE|2026-/);
    });
  }
});

test("CSV is private, inclusive, deterministic and RFC 4180 encoded", () => {
  const input = state({
    stays: [
      {
        id: "later-private-id",
        arrivalDate: "2026-08-10",
        departureDate: "2026-08-10",
        status: "planned",
        createdAt: "2026-07-01T12:00:00.000Z",
        updatedAt: "2026-07-01T12:00:00.000Z"
      },
      {
        id: "earlier-private-id",
        arrivalDate: "2026-08-01",
        departureDate: "2026-08-03",
        status: "actual",
        createdAt: "2026-07-01T12:00:00.000Z",
        updatedAt: "2026-07-01T12:00:00.000Z"
      }
    ]
  });

  const result = createStayCsv(input);

  assert.deepEqual(result, {
    ok: true,
    value: "ankomstdatum,avresedatum,status,kalenderdagar\r\n"
      + "2026-08-01,2026-08-03,faktisk,3\r\n"
      + "2026-08-10,2026-08-10,planerad,1\r\n"
  });
  assert.doesNotMatch(result.value, /private-id|createdAt|budgetDays/);
  assert.equal(createStayCsv(structuredClone(input)).value, result.value);
});

test("empty CSV contains only its stable header", () => {
  assert.deepEqual(createStayCsv(state({ stays: [] })), {
    ok: true,
    value: "ankomstdatum,avresedatum,status,kalenderdagar\r\n"
  });
});
```

- [x] **Step 2: Run the codec test and verify RED**

Run:

```bash
node --test test/data-transfer.test.js
```

Expected: FAIL because `src/data-transfer.js` and its exports do not exist.

- [x] **Step 3: Implement the pure transfer module**

Create `src/data-transfer.js` with:

```js
import { daysInclusive } from "./domain/dates.js";
import { decodeStoredState, serializeAppState } from "./storage.js";

export const MAX_IMPORT_BYTES = 1_048_576;

function failed(message) {
  return { ok: false, message };
}

function csvCell(value) {
  const text = String(value);
  return /[",\r\n]/.test(text)
    ? '"' + text.replaceAll('"', '""') + '"'
    : text;
}

export function createBackupJson(state) {
  try {
    return { ok: true, value: serializeAppState(state) };
  } catch {
    return failed("Backupen kunde inte skapas från den aktuella datan.");
  }
}

export function parseBackupJson(raw) {
  if (typeof raw !== "string") {
    return failed("Backupfilen innehåller inte giltig JSON.");
  }
  const decoded = decodeStoredState(raw.replace(/^\uFEFF/, ""));
  if (decoded.ok && decoded.state !== null) {
    return { ok: true, value: decoded.state };
  }
  const messages = {
    "unsupported-version": "Backupfilens version stöds inte.",
    "invalid-state": "Backupfilen har en ogiltig struktur.",
    "invalid-json": "Backupfilen innehåller inte giltig JSON."
  };
  return failed(
    messages[decoded.issue?.code]
      ?? "Backupfilen kunde inte läsas."
  );
}

export function createStayCsv(state) {
  let canonical;
  try {
    canonical = JSON.parse(serializeAppState(state));
  } catch {
    return failed("Vistelserna kunde inte exporteras från den aktuella datan.");
  }

  const statusOrder = { actual: 0, planned: 1 };
  const stays = [...canonical.stays].sort((left, right) =>
    left.arrivalDate.localeCompare(right.arrivalDate)
    || left.departureDate.localeCompare(right.departureDate)
    || statusOrder[left.status] - statusOrder[right.status]);
  const rows = stays.map((stay) => [
    stay.arrivalDate,
    stay.departureDate,
    stay.status === "actual" ? "faktisk" : "planerad",
    daysInclusive(stay.arrivalDate, stay.departureDate)
  ].map(csvCell).join(","));

  return {
    ok: true,
    value: [
      "ankomstdatum,avresedatum,status,kalenderdagar",
      ...rows
    ].join("\r\n") + "\r\n"
  };
}
```

- [x] **Step 4: Add immutability, BOM and invalid-state codec tests**

Extend `test/data-transfer.test.js` with:

```js
test("transfer codecs normalize without mutating their input", () => {
  const input = state();
  const before = structuredClone(input);
  const backup = createBackupJson(input);

  assert.deepEqual(input, before);
  assert.deepEqual(parseBackupJson("\uFEFF" + backup.value).value, input);
  assert.deepEqual(input, before);
});

test("transfer codecs reject demos and invalid canonical state", () => {
  assert.equal(createBackupJson({ ...state(), demo: true }).ok, false);
  assert.equal(createStayCsv({ version: 1, profile: null, stays: [{}] }).ok, false);
});
```

- [x] **Step 5: Run codec and storage tests and verify GREEN**

Run:

```bash
node --test test/data-transfer.test.js test/storage.test.js test/validation.test.js
```

Expected: PASS. `src/storage.js` remains unchanged.

- [x] **Step 6: Commit the pure codecs**

Run:

```bash
git diff --check
git add src/data-transfer.js test/data-transfer.test.js docs/superpowers/plans/2026-08-16-local-data-portability.md
git commit -m "feat: encode local backups and stay exports"
```

### Task 2: Add guarded controller data workflows

**Files:**
- Modify: `src/controller.js`
- Modify: `test/controller.test.js`
- Modify: `test/storage.test.js`

- [x] **Step 1: Extend the exact controller API test**

Add these names to the sorted expected API in `test/controller.test.js`:

```js
"cancelRestore",
"confirmRestore",
"createBackupDownload",
"createCsvDownload",
"previewRestore",
```

- [x] **Step 2: Add failing backup/export controller tests**

Add tests that initialize a controller with a valid state, then assert:

```js
const backup = controller.createBackupDownload();
assert.equal(backup.ok, true);
assert.equal(backup.download.filename, "sverigevistelseplaneraren-backup-2026-08-16.json");
assert.equal(backup.download.mimeType, "application/json;charset=utf-8");
assert.deepEqual(JSON.parse(backup.download.content), initialState);

const csv = controller.createCsvDownload();
assert.equal(csv.ok, true);
assert.equal(csv.download.filename, "sverigevistelseplaneraren-vistelser-2026-08-16.csv");
assert.equal(csv.download.mimeType, "text/csv;charset=utf-8");
assert.match(csv.download.content, /^ankomstdatum,avresedatum,status,kalenderdagar\r\n/);
assert.equal(repository.calls.save.length, 0);
```

Also assert an empty stay list returns `ok: false`, the exact message `Det finns inga vistelser att exportera.`, and no download.

- [ ] **Step 3: Add failing restore lifecycle tests**

Cover all of these in `test/controller.test.js` before production changes:

1. `previewRestore({ raw, fileName })` validates without `repository.save` and publishes only `{ fileName, hasProfile, stayCount }`.
2. Invalid and unsupported JSON do not publish a preview, save or replace state.
3. `confirmRestore()` without `{ confirmed: true }` does not save.
4. `cancelRestore()` clears the preview and preserves state.
5. Confirmed valid restore calls `repository.save(candidate)` exactly once and replaces controller state only after `{ ok: true }`.
6. Failed save preserves the old controller state and preview, publishes the storage issue and never claims persisted bytes are unchanged.
7. Demo mode blocks backup, CSV, preview and confirmation with the existing demo message.
8. A pending preview blocks profile/stay/delete/clear mutations until cancel or confirmation.
9. Export still works when the loaded storage issue is a session or memory fallback.
10. An already-blocking storage issue rejects preview before a candidate is published and requires successful clear first.

In `test/storage.test.js`, add a restore-named characterization using its existing fake-storage helper: start local and session with the old raw state, let the local candidate write succeed, make both session removal and overwrite fail, then assert `repository.save(candidate)` returns `storage-conflict`, local contains the candidate and session still contains the old raw state. This is a real repository test, not a controller fake. It documents why the UI must say "kan ha skrivits delvis".

Run:

```bash
node --test test/controller.test.js
```

Expected: FAIL on missing methods and preview state.

- [x] **Step 4: Add controller imports, state and result payload support**

At the top of `src/controller.js` import:

```js
import {
  createBackupJson,
  createStayCsv as encodeStayCsv,
  parseBackupJson
} from "./data-transfer.js";
```

Inside `createAppController`, add:

```js
let restoreCandidate = null;
let restorePreview = null;
```

Change the result helper without changing existing result shapes:

```js
function result(ok, message = "", fieldErrors = {}, extra = {}) {
  return { ok, message, fieldErrors, ...extra };
}
```

In `publish`, add the preview only while it exists:

```js
...(restorePreview ? { restorePreview } : {})
```

- [x] **Step 5: Add restore blocking and successful-persist cleanup**

Add:

```js
function blockedByRestore() {
  return restoreCandidate === null
    ? null
    : result(false, "Bekräfta eller avbryt återställningen först.");
}
```

Extend `persist` to accept an optional success callback:

```js
function persist(nextState, message, { onSuccess } = {}) {
  const blocked = blockedByStorage();
  if (blocked) return blocked;
  const saved = repository.save(nextState);
  storageIssue = saved.issue;
  if (!saved.ok) {
    publish();
    return result(false, saved.issue?.message ?? "Datan kunde inte sparas.");
  }
  state = nextState;
  demoState = null;
  editingProfile = false;
  onSuccess?.();
  publish();
  return result(true, message);
}
```

At the beginning of `saveProfile`, `saveStay`, `removeStay`, `confirmPastPlanned`, `showDemo`, `beginEditProfile`, `cancelEditProfile` and `clearAll`, combine the current demo guard with `blockedByRestore`. Do not apply the restore guard to read-only exports, `previewRestore`, `cancelRestore` or `confirmRestore`.

- [x] **Step 6: Implement download and restore use cases**

Add these functions inside `createAppController`:

```js
function createDownload(codec, filename, mimeType, emptyMessage = null) {
  const blocked = blockedByDemo();
  if (blocked) return blocked;
  if (!state?.profile) {
    return result(false, "Skapa en profil innan du exporterar data.");
  }
  if (emptyMessage && state.stays.length === 0) {
    return result(false, emptyMessage);
  }
  const encoded = codec(state);
  return encoded.ok
    ? result(true, "Filen är klar.", {}, {
        download: { filename, mimeType, content: encoded.value }
      })
    : result(false, encoded.message);
}

function createBackupDownload() {
  return createDownload(
    createBackupJson,
    "sverigevistelseplaneraren-backup-" + today + ".json",
    "application/json;charset=utf-8"
  );
}

function createCsvDownload() {
  return createDownload(
    encodeStayCsv,
    "sverigevistelseplaneraren-vistelser-" + today + ".csv",
    "text/csv;charset=utf-8",
    "Det finns inga vistelser att exportera."
  );
}

function previewRestore({ raw, fileName }) {
  const blocked = blockedByDemo() ?? blockedByStorage();
  if (blocked) return blocked;
  const parsed = parseBackupJson(raw);
  if (!parsed.ok) {
    return result(false, parsed.message);
  }
  restoreCandidate = parsed.value;
  restorePreview = {
    fileName: String(fileName || "backup.json").slice(0, 255),
    hasProfile: parsed.value.profile !== null,
    stayCount: parsed.value.stays.length
  };
  publish();
  return result(true, "Backupfilen är kontrollerad.");
}

function cancelRestore() {
  restoreCandidate = null;
  restorePreview = null;
  publish();
  return result(true, "Återställningen har avbrutits.");
}

function confirmRestore({ confirmed = false } = {}) {
  const blocked = blockedByDemo();
  if (blocked) return blocked;
  if (restoreCandidate === null || !confirmed) {
    return result(false, "Bekräfta att den aktuella datan ska ersättas.");
  }
  const restored = persist(restoreCandidate, "Backupen har återställts.", {
    onSuccess() {
      restoreCandidate = null;
      restorePreview = null;
    }
  });
  if (!restored.ok && storageIssue?.code === "storage-conflict") {
    return result(
      false,
      "Återställningen kunde inte slutföras. Backupen kan ha skrivits "
        + "delvis. Avbryt återställningen och ladda om sidan. Om "
        + "lagringsvarningen kvarstår, rensa appdatan och välj backupfilen igen."
    );
  }
  return restored;
}
```

On successful `clearAll`, also set both restore variables to `null`. Add the five new functions to the returned public controller object. Do not expose `restoreCandidate` through `publish` or `getSnapshot`.

- [x] **Step 7: Run controller, storage and codec tests and verify GREEN**

Run:

```bash
node --test test/data-transfer.test.js test/controller.test.js test/storage.test.js
npm run lint
git diff --check
```

Expected: all commands exit 0. Confirm the controller test proves the old controller state and preview survive, while the real repository test proves persisted layers can differ after the reported failure and the returned copy warns about it.

- [x] **Step 8: Commit the controller workflows**

Run:

```bash
git add src/controller.js test/controller.test.js test/storage.test.js docs/superpowers/plans/2026-08-16-local-data-portability.md
git commit -m "feat: restore local data with conflict handling"
```

### Task 3: Wire minimal accessible data controls

**Files:**
- Create: `src/ui/data-tools.js`
- Modify: `src/ui/cockpit.js`
- Modify: `src/ui/onboarding.js`
- Modify: `src/main.js`
- Modify: `styles.css`
- Modify: `test/ui.test.js`

- [ ] **Step 1: Add failing escaped data-tools markup tests**

Import the new renderer through the existing safe dynamic-import pattern in `test/ui.test.js`, then assert:

```js
const html = renderDataTools({
  canExport: true,
  restorePreview: {
    fileName: '<img src=x onerror="PRIVATE">.json',
    hasProfile: true,
    stayCount: 1
  }
});

assert.match(html, /Din data/);
assert.match(html, /data-action="download-backup"/);
assert.match(html, /data-action="download-csv"/);
assert.match(html, /data-action="choose-restore"/);
assert.match(html, /data-file-input="restore"/);
assert.match(html, /data-action="confirm-restore"/);
assert.match(html, /data-action="cancel-restore"/);
assert.match(html, /1 vistelse/);
assert.doesNotMatch(html, /<img|onerror="PRIVATE"/);
```

Also assert a null preview contains no confirmation controls, a count of 2 uses `2 vistelser`, and `canExport: false` keeps `choose-restore` while omitting `download-backup` and `download-csv`.

- [ ] **Step 2: Add failing browser integration tests**

Extend the test browser setup so `createBrowserApp` receives:

```js
const downloads = [];
const readFileText = async (file) => file.contents;
const downloadFile = (file) => downloads.push(file);
```

Add tests for:

1. Backup and CSV clicks create the exact filename, MIME and content without repository writes.
2. Empty CSV announces `Det finns inga vistelser att exportera.` and creates no download.
3. File larger than `MAX_IMPORT_BYTES` is rejected before `readFileText` is called.
4. Invalid JSON preserves state and repository bytes and announces a neutral error.
5. A fresh onboarding view can choose a valid file, publishes preview, and does not save before `confirm-restore`.
6. Cancel preserves state and returns focus to `choose-restore`.
7. Confirm saves once, replaces state, resets view year to the restored profile period and returns focus to a stable data control.
8. Failed save keeps confirmation visible; a storage conflict announces that the backup may have been written partially and guides cancel, reload and, if still blocked, clear/reselect.
9. The file input value is cleared before asynchronous work, so the same file can be selected again.
10. Demo markup has no data controls and controller methods remain blocked.

Run:

```bash
node --test --test-name-pattern="backup|CSV|restore|data tools" test/ui.test.js
```

Expected: FAIL on missing renderer/actions.

- [ ] **Step 3: Create the escaped renderer**

Create `src/ui/data-tools.js` with this complete implementation:

```js
const HTML_ENTITIES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) =>
    HTML_ENTITIES[character]);
}

function renderPreview(preview) {
  if (!preview) return "";
  const stayCount = preview.stayCount === 1
    ? "1 vistelse"
    : preview.stayCount + " vistelser";
  const profile = preview.hasProfile ? "Profil finns" : "Ingen profil";

  return '<section class="inline-confirm" aria-labelledby="restore-heading">'
    + '<h3 id="restore-heading">Ersätt aktuell data?</h3>'
    + "<p><strong>Fil:</strong> " + escapeHtml(preview.fileName) + "</p>"
    + "<p>" + escapeHtml(profile) + ", " + escapeHtml(stayCount) + ".</p>"
    + "<p>Den aktuella profilen och alla vistelser ersätts först när du "
    + "bekräftar.</p>"
    + '<div class="inline-confirm__actions">'
    + '<button class="primary-button" type="button" '
    + 'data-action="confirm-restore">Ja, ersätt aktuell data</button>'
    + '<button class="secondary-button" type="button" '
    + 'data-action="cancel-restore">Avbryt</button></div></section>';
}

export function renderDataTools({
  restorePreview = null,
  canExport = true
} = {}) {
  const exportActions = canExport
    ? '<button type="button" class="secondary-button" '
      + 'data-action="download-backup">Ladda ner backup</button>'
      + '<button type="button" class="secondary-button" '
      + 'data-action="download-csv">Exportera CSV</button>'
    : "";
  return '<section class="aside-card data-tools" '
    + 'aria-labelledby="data-tools-heading">'
    + '<h2 id="data-tools-heading">Din data</h2>'
    + "<p>Backupen sparas som en lokal JSON-fil. CSV innehåller endast "
    + "vistelser.</p>"
    + '<div class="data-tools__actions">'
    + exportActions
    + '<button type="button" class="secondary-button" '
    + 'data-action="choose-restore">Återställ backup</button>'
    + '<input class="sr-only" type="file" '
    + 'accept=".json,application/json" data-file-input="restore">'
    + "</div>" + renderPreview(restorePreview) + "</section>";
}
```

The module exports only `renderDataTools`. The filename and every dynamic count are escaped before markup generation.

- [ ] **Step 4: Compose data tools into the cockpit without redesign**

In `src/ui/cockpit.js` import `renderDataTools`, accept `restorePreview = null` in `buildCockpitModel` options, expose it on the model, and render `renderDataTools({ restorePreview: model.restorePreview, canExport: true })` in the existing aside only when `model.demo` is false.

In `src/ui/onboarding.js`, import `renderDataTools`, accept `restorePreview = null` and `canExport = false` in the renderer options, and append `renderDataTools({ restorePreview, canExport })` after the existing onboarding form. This makes restore possible with empty storage.

In `src/main.js`, pass `published.restorePreview ?? null` to both renderers and pass `canExport: Boolean(published.state?.profile)` to onboarding. Existing renders without a preview must keep the same markup except for the new data section.

- [ ] **Step 5: Add private browser download and injected seams**

Import `MAX_IMPORT_BYTES` from `src/data-transfer.js`. Add a private default download helper in `src/main.js`:

```js
function defaultDownloadFile(documentRef, windowRef, file) {
  const BlobType = safeWindowValue(windowRef, "Blob") ?? globalThis.Blob;
  const urlApi = safeWindowValue(windowRef, "URL") ?? globalThis.URL;
  if (
    typeof BlobType !== "function"
    || typeof urlApi?.createObjectURL !== "function"
    || typeof urlApi?.revokeObjectURL !== "function"
  ) {
    throw new Error("Nedladdning stöds inte i den här webbläsaren.");
  }
  const blob = new BlobType([file.content], { type: file.mimeType });
  const url = urlApi.createObjectURL(blob);
  try {
    const link = documentRef.createElement("a");
    link.href = url;
    link.download = file.filename;
    documentRef.body?.append?.(link);
    link.click();
    link.remove?.();
  } finally {
    urlApi.revokeObjectURL(url);
  }
}
```

Inside `createBrowserApp` define:

```js
const readFileText = options.readFileText ?? ((file) => file.text());
const downloadFile = options.downloadFile
  ?? ((file) => defaultDownloadFile(documentRef, windowRef, file));
```

Never log caught errors or include file content in an announcement.

- [ ] **Step 6: Wire click and change behavior**

In the app click delegation:

- `download-backup`: call controller, pass a successful `.download` to `downloadFile`, announce result.
- `download-csv`: same flow.
- `choose-restore`: call `.click()` on `[data-file-input="restore"]`.
- `cancel-restore`: call controller, announce, rerender focus to `choose-restore`.
- `confirm-restore`: call with `{ confirmed: true }`; on success reset `viewYear` and `focusedDate` when the restored state has a profile, rerender, and focus `[data-action="choose-restore"]` or the app root fallback; on failure focus `confirm-restore`.

Add one asynchronous app `change` listener:

```js
app.addEventListener("change", async (event) => {
  if (!event.target?.matches?.('[data-file-input="restore"]')) return;
  const input = event.target;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (file.size > MAX_IMPORT_BYTES) {
    announce("Backupfilen är större än 1 MiB och har inte lästs in.");
    return;
  }
  let raw;
  try {
    raw = await readFileText(file);
  } catch {
    announce("Backupfilen kunde inte läsas. Ingen data har ändrats.");
    return;
  }
  const previewed = controller.previewRestore({ raw, fileName: file.name });
  announce(previewed.message);
  if (previewed.ok) {
    app.querySelector?.('[data-action="confirm-restore"]')?.focus?.();
  }
});
```

Wrap download helper calls in `try/catch` and announce `Filen kunde inte laddas ner.` on failure. Do not pass caught error messages into the UI.

- [ ] **Step 7: Add only layout and target-size CSS**

Add compact rules for `.data-tools__actions` using the existing flex/gap patterns. Ensure every button is at least 44 px and the hidden file input uses the existing `.sr-only`. Do not add new colors, fonts, panels or responsive breakpoints unless a browser test demonstrates overflow.

- [ ] **Step 8: Run targeted browser/controller tests and verify GREEN**

Run:

```bash
node --test test/data-transfer.test.js test/controller.test.js test/ui.test.js
npm run lint
git diff --check
```

Expected: all commands exit 0, dynamic filenames are escaped, and no runtime console call exists.

- [ ] **Step 9: Commit the browser data tools**

Run:

```bash
git add src/ui/data-tools.js src/ui/cockpit.js src/ui/onboarding.js src/main.js styles.css test/ui.test.js docs/superpowers/plans/2026-08-16-local-data-portability.md
git commit -m "feat: add local backup and export controls"
```

### Task 4: Documentation, full verification and handback

**Files:**
- Modify: `README.md`
- Modify: `docs/qa/localhost.md`
- Modify: `docs/handoff/CURRENT.md`
- Modify: `docs/superpowers/plans/2026-08-16-local-data-portability.md`

- [ ] **Step 1: Document only shipped behavior**

After the UI exists, update README with:

```text
Under "Din data" kan användaren ladda ner en lokal JSON-backup, återställa en validerad backup efter uttrycklig bekräftelse och exportera vistelser som CSV. Filerna skickas inte till en server.
```

Keep the existing legal and local-storage boundary text.

- [ ] **Step 2: Keep localhost QA at seven steps**

Add one final step to `docs/qa/localhost.md` that verifies:

1. JSON download contains only AppState v1.
2. Valid restore shows preview and writes only after confirmation.
3. Cancel, invalid JSON, unsupported version, oversized file and an already-blocking store stop before persistence and preserve current data.
4. CSV header/order/status/day counts are exact and no profile answer, ID or timestamp is present.
5. Empty stay list creates no CSV download.
6. Same restore file can be selected twice.
7. Keyboard focus and live announcements work; demo has no data controls. A forced post-write storage conflict keeps controller state/preview, warns that persistent data may have changed and enters the blocking recovery flow.

- [ ] **Step 3: Update the current handoff to completed**

In `docs/handoff/CURRENT.md`, replace `NEXT_WORK` with a completed summary containing the final commit SHAs, test count and remaining product roadmap: account/cloud later, visual redesign last. Do not claim deployment or legal approval.

- [ ] **Step 4: Run one fresh serial full check**

Run:

```bash
npm run check
git diff --check
git status --short
```

Expected: lint, all tests and build pass; diff check exits 0; status contains only the four intended docs before commit.

- [ ] **Step 5: Run full localhost QA**

Run `npm run dev` and execute every step in `docs/qa/localhost.md` with:

- empty storage,
- normal local storage,
- denied local storage/session fallback,
- valid and invalid local files,
- keyboard-only restore confirmation,
- console and network inspection.

Record exact pass/fail evidence. Stop at the first product deviation, fix it test-first, rerun targeted tests, then restart the full QA from empty storage.

- [ ] **Step 6: Commit docs and checked plan**

Run:

```bash
git add README.md docs/qa/localhost.md docs/handoff/CURRENT.md docs/superpowers/plans/2026-08-16-local-data-portability.md
git commit -m "docs: verify local data portability"
```

- [ ] **Step 7: Produce the Codex review handoff**

Run:

```bash
npm run check
git status --short
git log --oneline --decorate -10
git diff dev...HEAD --stat
git diff dev...HEAD --name-only
```

Expected: final check exits 0 and worktree is clean. Return the exact evidence template from `CLAUDE.md`. Do not push or open a PR.

## Final acceptance

- Canonical JSON backup uses the existing AppState v1 schema and serializer.
- Restore is parse-first, previewed, explicitly confirmed and persisted only through the repository.
- Pre-save failures preserve old controller state and stored bytes. A repository failure preserves old controller state and preview; the tested post-write conflict path discloses that persistent layers may already differ.
- CSV is deterministic, inclusive, private and contains only the four locked columns.
- Demo blocks every data action; local/session/memory export stays available.
- No dependency, backend, cloud, analytics, schema change or visual redesign was introduced.
- Full automated verification, seven-step localhost QA and clean local commits are ready for independent Codex review.
