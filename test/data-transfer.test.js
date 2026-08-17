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

test("every exported CSV cell is a safe date, status or integer", () => {
  const result = createStayCsv(state({
    stays: [
      {
        id: "=cmd|' /C calc'!A0",
        arrivalDate: "2026-02-28",
        departureDate: "2026-03-01",
        status: "planned",
        createdAt: "2026-07-01T12:00:00.000Z",
        updatedAt: "2026-07-01T12:00:00.000Z"
      },
      {
        id: "b",
        arrivalDate: "2024-02-29",
        departureDate: "2024-02-29",
        status: "actual",
        createdAt: "2026-07-01T12:00:00.000Z",
        updatedAt: "2026-07-01T12:00:00.000Z"
      }
    ]
  }));
  const lines = result.value.split("\r\n").filter((line) => line.length > 0);

  assert.equal(lines[0], "ankomstdatum,avresedatum,status,kalenderdagar");
  assert.equal(lines.length, 3);
  for (const line of lines.slice(1)) {
    const cells = line.split(",");
    assert.equal(cells.length, 4);
    assert.match(cells[0], /^\d{4}-\d{2}-\d{2}$/);
    assert.match(cells[1], /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(["faktisk", "planerad"].includes(cells[2]));
    assert.match(cells[3], /^\d+$/);
    for (const cell of cells) {
      assert.doesNotMatch(cell, /^[=+\-@\t\r]/);
      assert.doesNotMatch(cell, /["\r\n]/);
    }
  }
  assert.doesNotMatch(result.value, /calc|cmd/);
  assert.equal(lines[1], "2024-02-29,2024-02-29,faktisk,1");
  assert.equal(lines[2], "2026-02-28,2026-03-01,planerad,2");
});
