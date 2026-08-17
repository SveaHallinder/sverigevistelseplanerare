import assert from "node:assert/strict";
import test from "node:test";
import { CHECKLIST_KEYS } from "../src/domain/validation.js";
import { serializeAppState } from "../src/storage.js";

const controllerModule = await import("../src/controller.js").catch(() => ({}));
const { createAppController } = controllerModule;

const TODAY = "2026-08-16";
const CREATED_AT = "2026-08-01T12:00:00.000Z";
const UPDATED_AT = "2026-08-16T12:00:00.000Z";

function profile(overrides = {}) {
  return {
    departureDate: "2025-02-15",
    budgetDays: 90,
    periodStart: "2026-01-01",
    periodEnd: "2026-12-31",
    swedishCitizen: "unanswered",
    livedInSwedenTenYears: "unanswered",
    connectionChecklist: Object.fromEntries(
      CHECKLIST_KEYS.map((key) => [key, "unanswered"])
    ),
    ...overrides
  };
}

function stay(id, overrides = {}) {
  return {
    id,
    arrivalDate: "2026-08-01",
    departureDate: "2026-08-05",
    status: "planned",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides
  };
}

function appState(overrides = {}) {
  return {
    version: 1,
    profile: profile(overrides.profile),
    stays: overrides.stays ?? []
  };
}

function fakeRepository({
  state = null,
  loadIssue = null,
  saveResult = { ok: true, issue: null, mode: "local" },
  clearResult = { ok: true, issue: null, mode: "local" }
} = {}) {
  const calls = { load: 0, save: [], clear: 0 };
  return {
    calls,
    load() {
      calls.load += 1;
      return { state, issue: loadIssue, mode: "local" };
    },
    save(nextState) {
      calls.save.push(nextState);
      return saveResult;
    },
    clear() {
      calls.clear += 1;
      return clearResult;
    }
  };
}

function setup({ repository = fakeRepository(), now = () => UPDATED_AT } = {}) {
  assert.equal(typeof createAppController, "function", "createAppController ska exporteras");
  const renders = [];
  const controller = createAppController({
    repository,
    render: (model) => renders.push(model),
    makeId: () => "new-stay",
    now,
    today: TODAY
  });
  return { controller, renders, repository };
}

test("controller exposes only the planned use-case API", () => {
  const { controller } = setup();

  assert.deepEqual(Object.keys(controller).sort(), [
    "beginEditProfile",
    "cancelEditProfile",
    "cancelRestore",
    "clearAll",
    "confirmPastPlanned",
    "confirmRestore",
    "createBackupDownload",
    "createCsvDownload",
    "exitDemo",
    "getSnapshot",
    "init",
    "previewRestore",
    "removeStay",
    "saveProfile",
    "saveStay",
    "showDemo"
  ]);
});

test("init loads once and publishes onboarding when no profile exists", () => {
  const repository = fakeRepository({
    loadIssue: { code: "memory-fallback", message: "Data försvinner vid omladdning." }
  });
  const { controller, renders } = setup({ repository });

  assert.deepEqual(controller.init(), { ok: true, message: "", fieldErrors: {} });
  assert.equal(repository.calls.load, 1);
  assert.deepEqual(renders.at(-1), {
    state: null,
    storageIssue: { code: "memory-fallback", message: "Data försvinner vid omladdning." },
    demo: false,
    editingProfile: false,
    today: TODAY
  });
});

test("init publishes the loaded cockpit state", () => {
  const state = appState();
  const { controller, renders } = setup({ repository: fakeRepository({ state }) });

  controller.init();

  assert.equal(renders.at(-1).state, state);
  assert.equal(renders.at(-1).demo, false);
});

test("saveProfile reports field errors without saving invalid input", () => {
  const repository = fakeRepository();
  const { controller, renders } = setup({ repository });
  controller.init();

  const result = controller.saveProfile(profile({ departureDate: "inte-ett-datum" }));

  assert.equal(result.ok, false);
  assert.equal(result.fieldErrors.departureDate, "Ange ett giltigt utflyttningsdatum.");
  assert.equal(repository.calls.save.length, 0);
  assert.equal(renders.length, 1);
});

test("saveProfile persists valid input and publishes the cockpit", () => {
  const repository = fakeRepository();
  const { controller, renders } = setup({ repository });
  controller.init();

  const result = controller.saveProfile(profile());

  assert.deepEqual(result, {
    ok: true,
    message: "Din plan har sparats.",
    fieldErrors: {}
  });
  assert.equal(repository.calls.save.length, 1);
  assert.deepEqual(repository.calls.save[0].profile, profile());
  assert.equal(renders.at(-1).state, repository.calls.save[0]);
});

test("saveStay adds, updates and removes a stay through immutable state mutations", () => {
  const initial = appState();
  const repository = fakeRepository({ state: initial });
  const { controller } = setup({ repository });
  controller.init();

  const added = controller.saveStay({
    arrivalDate: "2026-08-10",
    departureDate: "2026-08-12",
    status: "planned"
  });
  assert.equal(added.ok, true);
  assert.deepEqual(controller.getSnapshot().state.stays[0], {
    id: "new-stay",
    arrivalDate: "2026-08-10",
    departureDate: "2026-08-12",
    status: "planned",
    createdAt: UPDATED_AT,
    updatedAt: UPDATED_AT
  });

  const updated = controller.saveStay({
    arrivalDate: "2026-08-11",
    departureDate: "2026-08-13",
    status: "actual"
  }, "new-stay");
  assert.equal(updated.ok, true);
  assert.equal(controller.getSnapshot().state.stays[0].createdAt, UPDATED_AT);
  assert.equal(controller.getSnapshot().state.stays[0].arrivalDate, "2026-08-11");
  assert.equal(controller.getSnapshot().state.stays[0].status, "actual");

  const removed = controller.removeStay("new-stay");
  assert.equal(removed.ok, true);
  assert.deepEqual(controller.getSnapshot().state.stays, []);
  assert.equal(repository.calls.save.length, 3);
  assert.deepEqual(initial.stays, []);
});

test("saveStay requires a profile and returns field errors for an invalid stay", () => {
  const repository = fakeRepository();
  const { controller } = setup({ repository });
  controller.init();

  assert.deepEqual(controller.saveStay({}), {
    ok: false,
    message: "Skapa en profil innan du lägger till vistelser.",
    fieldErrors: {}
  });

  controller.saveProfile(profile());
  const invalid = controller.saveStay({
    arrivalDate: "2026-08-12",
    departureDate: "2026-08-10",
    status: "planned"
  });
  assert.equal(invalid.ok, false);
  assert.equal(
    invalid.fieldErrors.departureDate,
    "Avresedatum måste vara samma dag eller senare än ankomstdatum."
  );
});

test("a repository save failure preserves state and publishes the sticky issue", () => {
  const initial = appState({ stays: [stay("existing")] });
  const failure = {
    ok: false,
    issue: { code: "storage-conflict", message: "Rensa appdatan och försök igen." },
    mode: "local"
  };
  const repository = fakeRepository({ state: initial, saveResult: failure });
  const { controller, renders } = setup({ repository });
  controller.init();

  const result = controller.saveStay({
    arrivalDate: "2026-09-01",
    departureDate: "2026-09-02",
    status: "actual"
  });

  assert.equal(result.ok, false);
  assert.equal(controller.getSnapshot().state, initial);
  assert.deepEqual(controller.getSnapshot().storageIssue, failure.issue);
  assert.equal(renders.at(-1).state, initial);
  assert.deepEqual(renders.at(-1).storageIssue, failure.issue);
});

test("storage issue remains visible through profile edit rerenders", () => {
  const storageIssue = {
    code: "session-fallback",
    message: "Data kan försvinna när sidan stängs."
  };
  const { controller, renders } = setup({
    repository: fakeRepository({ state: appState(), loadIssue: storageIssue })
  });
  controller.init();

  controller.beginEditProfile();
  controller.cancelEditProfile();

  assert.equal(renders.at(-2).editingProfile, true);
  assert.equal(renders.at(-1).editingProfile, false);
  assert.deepEqual(renders.at(-2).storageIssue, storageIssue);
  assert.deepEqual(renders.at(-1).storageIssue, storageIssue);
});

test("editing a profile preserves every existing stay", () => {
  const existingStays = [
    stay("actual", { status: "actual" }),
    stay("planned", { arrivalDate: "2026-09-01", departureDate: "2026-09-03" })
  ];
  const repository = fakeRepository({ state: appState({ stays: existingStays }) });
  const { controller } = setup({ repository });
  controller.init();
  controller.beginEditProfile();

  const saved = controller.saveProfile(profile({ budgetDays: 75 }));

  assert.equal(saved.ok, true);
  assert.deepEqual(repository.calls.save[0].stays, existingStays);
  assert.deepEqual(controller.getSnapshot().state.stays, existingStays);
  assert.equal(controller.getSnapshot().editingProfile, false);
});

test("an unsupported stored version blocks profile saves until a successful clear", () => {
  const unsupported = {
    code: "unsupported-version",
    message: "Den sparade dataversionen stöds inte. Datan har inte skrivits över."
  };
  const repository = fakeRepository({ loadIssue: unsupported });
  const { controller } = setup({ repository });
  controller.init();

  const blocked = controller.saveProfile(profile());

  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /dataversionen stöds inte/);
  assert.equal(repository.calls.save.length, 0);

  assert.equal(controller.clearAll({ confirmed: true }).ok, true);
  assert.equal(controller.saveProfile(profile()).ok, true);
  assert.equal(repository.calls.save.length, 1);
});

test("confirmPastPlanned changes only the selected stay to actual", () => {
  const first = stay("first", { departureDate: "2026-07-05" });
  const second = stay("second", {
    arrivalDate: "2026-07-10",
    departureDate: "2026-07-12"
  });
  const repository = fakeRepository({ state: appState({ stays: [first, second] }) });
  const { controller } = setup({ repository });
  controller.init();

  const result = controller.confirmPastPlanned("second");

  assert.equal(result.ok, true);
  assert.deepEqual(
    controller.getSnapshot().state.stays.map(({ id, status }) => ({ id, status })),
    [{ id: "first", status: "planned" }, { id: "second", status: "actual" }]
  );
});

test("confirmPastPlanned refuses actual and future planned stays", () => {
  const actual = stay("actual", { status: "actual", departureDate: "2026-07-05" });
  const future = stay("future", {
    arrivalDate: "2026-09-10",
    departureDate: "2026-09-12"
  });
  const repository = fakeRepository({ state: appState({ stays: [actual, future] }) });
  const { controller } = setup({ repository });
  controller.init();

  const actualResult = controller.confirmPastPlanned("actual");
  const futureResult = controller.confirmPastPlanned("future");

  assert.equal(actualResult.ok, false);
  assert.equal(futureResult.ok, false);
  assert.match(actualResult.message, /passerad planerad vistelse/);
  assert.match(futureResult.message, /passerad planerad vistelse/);
  assert.equal(repository.calls.save.length, 0);
  assert.deepEqual(controller.getSnapshot().state.stays, [actual, future]);
});

test("showDemo is temporary, never saves, and exitDemo returns to onboarding", () => {
  const repository = fakeRepository();
  const { controller, renders } = setup({ repository });
  controller.init();

  assert.equal(controller.showDemo().ok, true);
  assert.equal(repository.calls.save.length, 0);
  assert.equal(renders.at(-1).state.demo, true);
  assert.equal(renders.at(-1).demo, true);
  assert.equal(controller.getSnapshot().state, null);

  assert.equal(controller.exitDemo().ok, true);
  assert.equal(renders.at(-1).state, null);
  assert.equal(renders.at(-1).demo, false);
});

test("demo mode blocks controller mutations and repository writes", () => {
  const repository = fakeRepository();
  const { controller } = setup({ repository });
  controller.init();
  controller.showDemo();

  const attempts = [
    controller.saveProfile(profile()),
    controller.saveStay({
      arrivalDate: "2026-08-20",
      departureDate: "2026-08-22",
      status: "planned"
    }),
    controller.removeStay("demo-april"),
    controller.confirmPastPlanned("demo-august"),
    controller.clearAll({ confirmed: true }),
    controller.beginEditProfile()
  ];

  assert.ok(attempts.every((attempt) => attempt.ok === false));
  assert.ok(attempts.every((attempt) => /Avsluta demoexemplet/.test(attempt.message)));
  assert.equal(repository.calls.save.length, 0);
  assert.equal(repository.calls.clear, 0);
  assert.equal(controller.getSnapshot().demo, true);
  assert.equal(controller.getSnapshot().editingProfile, false);
});

test("showDemo refuses to replace a real profile", () => {
  const repository = fakeRepository({ state: appState() });
  const { controller } = setup({ repository });
  controller.init();

  const result = controller.showDemo();

  assert.equal(result.ok, false);
  assert.match(result.message, /bara öppnas innan/);
  assert.equal(repository.calls.save.length, 0);
  assert.equal(controller.getSnapshot().demo, false);
});

test("clearAll requires explicit confirmation and returns to onboarding", () => {
  const repository = fakeRepository({ state: appState({ stays: [stay("one")] }) });
  const { controller, renders } = setup({ repository });
  controller.init();

  const refused = controller.clearAll();
  assert.equal(refused.ok, false);
  assert.equal(repository.calls.clear, 0);
  assert.notEqual(controller.getSnapshot().state, null);

  const cleared = controller.clearAll({ confirmed: true });
  assert.equal(cleared.ok, true);
  assert.equal(repository.calls.clear, 1);
  assert.equal(controller.getSnapshot().state, null);
  assert.equal(renders.at(-1).state, null);
});

test("a failed clear preserves the loaded state", () => {
  const initial = appState();
  const repository = fakeRepository({
    state: initial,
    clearResult: {
      ok: false,
      issue: { code: "clear-failed", message: "All appdata kunde inte rensas." },
      mode: "local"
    }
  });
  const { controller, renders } = setup({ repository });
  controller.init();

  const result = controller.clearAll({ confirmed: true });

  assert.equal(result.ok, false);
  assert.equal(controller.getSnapshot().state, initial);
  assert.deepEqual(controller.getSnapshot().storageIssue, {
    code: "clear-failed",
    message: "All appdata kunde inte rensas."
  });
  assert.deepEqual(renders.at(-1).storageIssue, {
    code: "clear-failed",
    message: "All appdata kunde inte rensas."
  });
});

function backupRaw(state) {
  return serializeAppState(state);
}

function restorableState() {
  return appState({
    profile: { budgetDays: 30 },
    stays: [stay("restored", { arrivalDate: "2026-09-01", departureDate: "2026-09-02" })]
  });
}

test("createBackupDownload and createCsvDownload never write to the repository", () => {
  const initialState = appState({ stays: [stay("one")] });
  const repository = fakeRepository({ state: initialState });
  const { controller } = setup({ repository });
  controller.init();

  const backup = controller.createBackupDownload();
  assert.equal(backup.ok, true);
  assert.equal(
    backup.download.filename,
    "sverigevistelseplaneraren-backup-2026-08-16.json"
  );
  assert.equal(backup.download.mimeType, "application/json;charset=utf-8");
  assert.deepEqual(JSON.parse(backup.download.content), initialState);

  const csv = controller.createCsvDownload();
  assert.equal(csv.ok, true);
  assert.equal(
    csv.download.filename,
    "sverigevistelseplaneraren-vistelser-2026-08-16.csv"
  );
  assert.equal(csv.download.mimeType, "text/csv;charset=utf-8");
  assert.match(
    csv.download.content,
    /^ankomstdatum,avresedatum,status,kalenderdagar\r\n/
  );
  assert.equal(repository.calls.save.length, 0);
});

test("createCsvDownload refuses an empty stay list without a download", () => {
  const repository = fakeRepository({ state: appState() });
  const { controller } = setup({ repository });
  controller.init();

  const csv = controller.createCsvDownload();

  assert.equal(csv.ok, false);
  assert.equal(csv.message, "Det finns inga vistelser att exportera.");
  assert.equal(Object.hasOwn(csv, "download"), false);
  assert.equal(repository.calls.save.length, 0);
});

test("downloads require a real profile before exporting", () => {
  const { controller } = setup();
  controller.init();

  assert.deepEqual(controller.createBackupDownload(), {
    ok: false,
    message: "Skapa en profil innan du exporterar data.",
    fieldErrors: {}
  });
});

test("previewRestore validates without saving and publishes only safe fields", () => {
  const initialState = appState({ stays: [stay("existing")] });
  const repository = fakeRepository({ state: initialState });
  const { controller, renders } = setup({ repository });
  controller.init();

  const previewed = controller.previewRestore({
    raw: backupRaw(restorableState()),
    fileName: "min-backup.json"
  });

  assert.equal(previewed.ok, true);
  assert.equal(previewed.message, "Backupfilen är kontrollerad.");
  assert.equal(repository.calls.save.length, 0);
  assert.equal(controller.getSnapshot().state, initialState);
  assert.deepEqual(renders.at(-1).restorePreview, {
    fileName: "min-backup.json",
    hasProfile: true,
    stayCount: 1
  });
  assert.equal(Object.hasOwn(controller.getSnapshot(), "restoreCandidate"), false);
});

test("invalid and unsupported backups never publish a preview or save", async (context) => {
  const cases = [
    ["invalid JSON", "{inte-json", "Backupfilen innehåller inte giltig JSON."],
    [
      "unsupported version",
      JSON.stringify({ version: 2, profile: null, stays: [] }),
      "Backupfilens version stöds inte."
    ],
    [
      "invalid structure",
      JSON.stringify({ version: 1, profile: null, stays: [{}] }),
      "Backupfilen har en ogiltig struktur."
    ]
  ];

  for (const [name, raw, message] of cases) {
    await context.test(name, () => {
      const initialState = appState({ stays: [stay("existing")] });
      const repository = fakeRepository({ state: initialState });
      const { controller, renders } = setup({ repository });
      controller.init();
      const rendersBefore = renders.length;

      const previewed = controller.previewRestore({ raw, fileName: "x.json" });

      assert.equal(previewed.ok, false);
      assert.equal(previewed.message, message);
      assert.equal(repository.calls.save.length, 0);
      assert.equal(controller.getSnapshot().state, initialState);
      assert.equal(renders.length, rendersBefore);
      assert.equal(Object.hasOwn(renders.at(-1), "restorePreview"), false);
    });
  }
});

test("confirmRestore without explicit confirmation never saves", () => {
  const repository = fakeRepository({ state: appState() });
  const { controller } = setup({ repository });
  controller.init();
  controller.previewRestore({
    raw: backupRaw(restorableState()),
    fileName: "backup.json"
  });

  const unconfirmed = controller.confirmRestore();

  assert.equal(unconfirmed.ok, false);
  assert.equal(unconfirmed.message, "Bekräfta att den aktuella datan ska ersättas.");
  assert.equal(repository.calls.save.length, 0);
});

test("cancelRestore clears the preview and preserves current data", () => {
  const initialState = appState({ stays: [stay("existing")] });
  const repository = fakeRepository({ state: initialState });
  const { controller, renders } = setup({ repository });
  controller.init();
  controller.previewRestore({
    raw: backupRaw(restorableState()),
    fileName: "backup.json"
  });

  const cancelled = controller.cancelRestore();

  assert.equal(cancelled.ok, true);
  assert.equal(cancelled.message, "Återställningen har avbrutits.");
  assert.equal(repository.calls.save.length, 0);
  assert.equal(controller.getSnapshot().state, initialState);
  assert.equal(Object.hasOwn(renders.at(-1), "restorePreview"), false);
  assert.equal(controller.confirmRestore({ confirmed: true }).ok, false);
});

test("a confirmed restore saves once and replaces state only after success", () => {
  const initialState = appState({ stays: [stay("existing")] });
  const candidate = restorableState();
  const repository = fakeRepository({ state: initialState });
  const { controller, renders } = setup({ repository });
  controller.init();
  controller.previewRestore({
    raw: backupRaw(candidate),
    fileName: "backup.json"
  });

  const restored = controller.confirmRestore({ confirmed: true });

  assert.equal(restored.ok, true);
  assert.equal(restored.message, "Backupen har återställts.");
  assert.equal(repository.calls.save.length, 1);
  assert.deepEqual(repository.calls.save[0], candidate);
  assert.deepEqual(controller.getSnapshot().state, candidate);
  assert.equal(Object.hasOwn(renders.at(-1), "restorePreview"), false);
});

test("a failed restore save keeps state, keeps the preview and warns about partial writes", () => {
  const initialState = appState({ stays: [stay("existing")] });
  const failure = {
    ok: false,
    issue: {
      code: "storage-conflict",
      message: "Sparad data har ändrats. Ladda om först."
    },
    mode: "local"
  };
  const repository = fakeRepository({ state: initialState, saveResult: failure });
  const { controller, renders } = setup({ repository });
  controller.init();
  controller.previewRestore({
    raw: backupRaw(restorableState()),
    fileName: "backup.json"
  });

  const restored = controller.confirmRestore({ confirmed: true });

  assert.equal(restored.ok, false);
  assert.match(restored.message, /kan ha skrivits delvis/);
  assert.match(restored.message, /Avbryt återställningen och ladda om sidan/);
  assert.match(restored.message, /rensa appdatan och välj backupfilen igen/);
  assert.doesNotMatch(restored.message, /oförändrad|inte ändrats/);
  assert.equal(controller.getSnapshot().state, initialState);
  assert.deepEqual(controller.getSnapshot().storageIssue, failure.issue);
  assert.deepEqual(renders.at(-1).restorePreview, {
    fileName: "backup.json",
    hasProfile: true,
    stayCount: 1
  });
});

test("demo mode blocks every data workflow", () => {
  const repository = fakeRepository();
  const { controller } = setup({ repository });
  controller.init();
  controller.showDemo();

  const attempts = [
    controller.createBackupDownload(),
    controller.createCsvDownload(),
    controller.previewRestore({
      raw: backupRaw(restorableState()),
      fileName: "backup.json"
    }),
    controller.confirmRestore({ confirmed: true })
  ];

  assert.ok(attempts.every((attempt) => attempt.ok === false));
  assert.ok(attempts.every((attempt) => /Avsluta demoexemplet/.test(attempt.message)));
  assert.equal(repository.calls.save.length, 0);
});

test("a pending restore preview blocks every mutation until it is resolved", () => {
  const initialState = appState({ stays: [stay("existing")] });
  const repository = fakeRepository({ state: initialState });
  const { controller } = setup({ repository });
  controller.init();
  controller.previewRestore({
    raw: backupRaw(restorableState()),
    fileName: "backup.json"
  });

  const attempts = [
    controller.saveProfile(profile({ budgetDays: 45 })),
    controller.saveStay({
      arrivalDate: "2026-08-20",
      departureDate: "2026-08-22",
      status: "planned"
    }),
    controller.removeStay("existing"),
    controller.confirmPastPlanned("existing"),
    controller.clearAll({ confirmed: true }),
    controller.beginEditProfile(),
    controller.showDemo()
  ];

  assert.ok(attempts.every((attempt) => attempt.ok === false));
  assert.ok(attempts.every((attempt) =>
    /Bekräfta eller avbryt återställningen först/.test(attempt.message)));
  assert.equal(repository.calls.save.length, 0);
  assert.equal(repository.calls.clear, 0);

  assert.equal(controller.cancelRestore().ok, true);
  assert.equal(controller.saveProfile(profile({ budgetDays: 45 })).ok, true);
});

test("export still works while a session or memory fallback issue is loaded", async (context) => {
  const fallbacks = [
    { code: "session-fallback", message: "Data kan försvinna när sidan stängs." },
    { code: "memory-fallback", message: "Data försvinner när sidan laddas om." }
  ];

  for (const loadIssue of fallbacks) {
    await context.test(loadIssue.code, () => {
      const repository = fakeRepository({
        state: appState({ stays: [stay("one")] }),
        loadIssue
      });
      const { controller } = setup({ repository });
      controller.init();

      assert.equal(controller.createBackupDownload().ok, true);
      assert.equal(controller.createCsvDownload().ok, true);
      assert.equal(repository.calls.save.length, 0);
    });
  }
});

test("a blocking storage issue rejects preview until a successful clear", () => {
  const unsupported = {
    code: "unsupported-version",
    message: "Den sparade dataversionen stöds inte. Datan har inte skrivits över."
  };
  const repository = fakeRepository({ loadIssue: unsupported });
  const { controller, renders } = setup({ repository });
  controller.init();

  const blocked = controller.previewRestore({
    raw: backupRaw(restorableState()),
    fileName: "backup.json"
  });

  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /dataversionen stöds inte/);
  assert.equal(Object.hasOwn(renders.at(-1), "restorePreview"), false);
  assert.equal(repository.calls.save.length, 0);

  assert.equal(controller.clearAll({ confirmed: true }).ok, true);
  assert.equal(controller.previewRestore({
    raw: backupRaw(restorableState()),
    fileName: "backup.json"
  }).ok, true);
  assert.equal(controller.confirmRestore({ confirmed: true }).ok, true);
  assert.equal(repository.calls.save.length, 1);
});

test("a successful clear discards a pending restore candidate", () => {
  const repository = fakeRepository({ state: appState({ stays: [stay("one")] }) });
  const { controller, renders } = setup({ repository });
  controller.init();
  controller.previewRestore({
    raw: backupRaw(restorableState()),
    fileName: "backup.json"
  });
  controller.cancelRestore();
  controller.previewRestore({
    raw: backupRaw(restorableState()),
    fileName: "backup.json"
  });
  controller.cancelRestore();

  assert.equal(controller.clearAll({ confirmed: true }).ok, true);
  assert.equal(Object.hasOwn(renders.at(-1), "restorePreview"), false);
  assert.equal(controller.confirmRestore({ confirmed: true }).ok, false);
});
