import assert from "node:assert/strict";
import test from "node:test";
import { CHECKLIST_KEYS } from "../src/domain/validation.js";

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
    "clearAll",
    "confirmPastPlanned",
    "exitDemo",
    "getSnapshot",
    "init",
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
