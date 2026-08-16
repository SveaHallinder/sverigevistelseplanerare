import assert from "node:assert/strict";
import test from "node:test";
import * as stateApi from "../src/domain/state.js";
import { validateAppState } from "../src/domain/validation.js";

const {
  addStay,
  createEmptyState,
  removeStay,
  setProfile,
  updateStay
} = stateApi;

const validProfile = {
  departureDate: "2025-05-10",
  budgetDays: 90,
  periodStart: "2026-01-01",
  periodEnd: "2026-12-31",
  swedishCitizen: "yes",
  livedInSwedenTenYears: "unanswered",
  connectionChecklist: {
    yearRoundHome: "no",
    spouseOrMinorChildren: "no",
    businessInSweden: "no",
    businessInfluence: "no",
    propertyInSweden: "no",
    otherStrongTies: "unanswered",
    workDuringStays: "no"
  }
};

const stayInput = {
  arrivalDate: "2026-08-01",
  departureDate: "2026-08-03",
  status: "planned"
};

const createdStay = {
  id: "stay-1",
  ...stayInput,
  createdAt: "2026-08-16T12:00:00.000Z",
  updatedAt: "2026-08-16T12:00:00.000Z"
};

test("state exports only the documented API", () => {
  assert.deepEqual(Object.keys(stateApi).sort(), [
    "addStay",
    "createEmptyState",
    "removeStay",
    "setProfile",
    "updateStay"
  ]);
});

test("createEmptyState returns a fresh versioned state", () => {
  const first = createEmptyState();
  const second = createEmptyState();

  assert.deepEqual(first, { version: 1, profile: null, stays: [] });
  assert.deepEqual(second, first);
  assert.notEqual(second, first);
  assert.notEqual(second.stays, first.stays);
});

test("setProfile validates and immutably stores a normalized profile", () => {
  const state = createEmptyState();
  const input = {
    ...validProfile,
    budgetDays: "90",
    connectionChecklist: { ...validProfile.connectionChecklist }
  };
  const stateBefore = structuredClone(state);
  const inputBefore = structuredClone(input);

  const result = setProfile(state, input);

  assert.deepEqual(result, {
    ok: true,
    value: { version: 1, profile: validProfile, stays: [] }
  });
  assert.deepEqual(state, stateBefore);
  assert.deepEqual(input, inputBefore);
  assert.notEqual(result.value, state);
  assert.equal(result.value.stays, state.stays);
  assert.notEqual(result.value.profile, input);
  assert.notEqual(result.value.profile.connectionChecklist, input.connectionChecklist);
});

test("setProfile returns validation errors without changing state", () => {
  const state = createEmptyState();

  const result = setProfile(state, { ...validProfile, budgetDays: 0 });

  assert.deepEqual(result, {
    ok: false,
    fieldErrors: {
      budgetDays: "Dagbudgeten måste vara ett heltal på minst 1."
    },
    message: "Kontrollera de markerade fälten."
  });
  assert.deepEqual(state, { version: 1, profile: null, stays: [] });
});

test("addStay appends exact metadata without mutating state or input", () => {
  const state = createEmptyState();
  const input = { ...stayInput };
  const stateBefore = structuredClone(state);
  const inputBefore = structuredClone(input);

  const result = addStay(state, input, {
    id: "stay-1",
    timestamp: "2026-08-16T12:00:00.000Z"
  });

  assert.deepEqual(result, {
    ok: true,
    value: { version: 1, profile: null, stays: [createdStay] }
  });
  assert.deepEqual(state, stateBefore);
  assert.deepEqual(input, inputBefore);
  assert.notEqual(result.value, state);
  assert.notEqual(result.value.stays, state.stays);
  assert.notEqual(result.value.stays[0], input);
  assert.equal(validateAppState(result.value).ok, true);
});

test("addStay returns validation errors without changing state", () => {
  const state = createEmptyState();

  const result = addStay(state, {
    ...stayInput,
    departureDate: "2026-07-31"
  }, {
    id: "stay-1",
    timestamp: "2026-08-16T12:00:00.000Z"
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.fieldErrors.departureDate,
    "Avresedatum måste vara samma dag eller senare än ankomstdatum."
  );
  assert.deepEqual(state, { version: 1, profile: null, stays: [] });
});

test("addStay rejects an id that is already in use without changing state", () => {
  const state = { version: 1, profile: null, stays: [createdStay] };
  const before = structuredClone(state);

  const result = addStay(state, stayInput, {
    id: "stay-1",
    timestamp: "2026-08-17T12:00:00.000Z"
  });

  assert.deepEqual(result, {
    ok: false,
    fieldErrors: {},
    message: "Vistelsen kunde inte hanteras eftersom datan innehåller dubbletter."
  });
  assert.deepEqual(state, before);
});

test("addStay rejects invalid injected metadata without changing state", async (context) => {
  const cases = [
    { id: "", timestamp: "2026-08-16T12:00:00.000Z" },
    { id: 1, timestamp: "2026-08-16T12:00:00.000Z" },
    { id: "stay-1", timestamp: 0 },
    { id: "stay-1", timestamp: "2026-08-16" },
    { id: "stay-1", timestamp: "2026-02-29T12:00:00.000Z" }
  ];

  for (const metadata of cases) {
    await context.test(JSON.stringify(metadata), () => {
      const state = createEmptyState();
      const before = structuredClone(state);
      const result = addStay(state, stayInput, metadata);

      assert.deepEqual(result, {
        ok: false,
        fieldErrors: {},
        message: "Vistelsen kunde inte sparas eftersom id eller tidsstämpel är ogiltig."
      });
      assert.deepEqual(state, before);
    });
  }
});

test("updateStay preserves identity metadata and immutable reference boundaries", () => {
  const untouchedStay = {
    ...createdStay,
    id: "stay-2",
    arrivalDate: "2026-09-01",
    departureDate: "2026-09-01"
  };
  const state = { version: 1, profile: validProfile, stays: [createdStay, untouchedStay] };
  const stateBefore = structuredClone(state);

  const result = updateStay(state, "stay-1", {
    arrivalDate: "2026-08-02",
    departureDate: "2026-08-05",
    status: "actual"
  }, { timestamp: "2026-08-17T12:00:00.000Z" });

  assert.deepEqual(result.value.stays[0], {
    id: "stay-1",
    arrivalDate: "2026-08-02",
    departureDate: "2026-08-05",
    status: "actual",
    createdAt: "2026-08-16T12:00:00.000Z",
    updatedAt: "2026-08-17T12:00:00.000Z"
  });
  assert.deepEqual(state, stateBefore);
  assert.notEqual(result.value, state);
  assert.notEqual(result.value.stays, state.stays);
  assert.notEqual(result.value.stays[0], state.stays[0]);
  assert.equal(result.value.stays[1], state.stays[1]);
  assert.equal(result.value.profile, state.profile);
  assert.equal(validateAppState(result.value).ok, true);
});

test("updateStay returns validation errors without changing the existing stay", () => {
  const state = { version: 1, profile: null, stays: [createdStay] };
  const before = structuredClone(state);

  const result = updateStay(state, "stay-1", {
    ...stayInput,
    status: "draft"
  }, { timestamp: "2026-08-17T12:00:00.000Z" });

  assert.deepEqual(result, {
    ok: false,
    fieldErrors: { status: "Välj faktisk eller planerad vistelse." },
    message: "Kontrollera de markerade fälten."
  });
  assert.deepEqual(state, before);
});

test("updateStay reports an unknown id", () => {
  const state = { version: 1, profile: null, stays: [createdStay] };

  assert.deepEqual(updateStay(state, "missing", stayInput, {
    timestamp: "2026-08-17T12:00:00.000Z"
  }), {
    ok: false,
    fieldErrors: {},
    message: "Vistelsen kunde inte hittas."
  });
});

test("updateStay rejects duplicate ids without changing state", () => {
  const state = {
    version: 1,
    profile: null,
    stays: [createdStay, { ...createdStay }]
  };
  const before = structuredClone(state);

  const result = updateStay(state, "stay-1", {
    ...stayInput,
    status: "actual"
  }, { timestamp: "2026-08-17T12:00:00.000Z" });

  assert.deepEqual(result, {
    ok: false,
    fieldErrors: {},
    message: "Vistelsen kunde inte hanteras eftersom datan innehåller dubbletter."
  });
  assert.deepEqual(state, before);
});

test("updateStay rejects invalid injected timestamps without changing state", async (context) => {
  const timestamps = [
    0,
    "2026-08-17",
    "2026-02-29T12:00:00.000Z",
    "2026-08-16T11:59:59.999Z"
  ];

  for (const timestamp of timestamps) {
    await context.test(String(timestamp), () => {
      const state = { version: 1, profile: null, stays: [createdStay] };
      const before = structuredClone(state);
      const result = updateStay(
        state,
        "stay-1",
        { ...stayInput, status: "actual" },
        { timestamp }
      );

      assert.deepEqual(result, {
        ok: false,
        fieldErrors: {},
        message: "Vistelsen kunde inte sparas eftersom id eller tidsstämpel är ogiltig."
      });
      assert.deepEqual(state, before);
    });
  }
});

test("removeStay removes immutably and preserves retained stay references", () => {
  const retainedStay = { ...createdStay, id: "stay-2" };
  const state = { version: 1, profile: validProfile, stays: [createdStay, retainedStay] };
  const before = structuredClone(state);

  const result = removeStay(state, "stay-1");

  assert.deepEqual(result.value, {
    version: 1,
    profile: validProfile,
    stays: [retainedStay]
  });
  assert.deepEqual(state, before);
  assert.notEqual(result.value, state);
  assert.notEqual(result.value.stays, state.stays);
  assert.equal(result.value.stays[0], state.stays[1]);
  assert.equal(result.value.profile, state.profile);
});

test("removeStay reports an unknown id", () => {
  const state = { version: 1, profile: null, stays: [createdStay] };

  assert.deepEqual(removeStay(state, "missing"), {
    ok: false,
    fieldErrors: {},
    message: "Vistelsen kunde inte hittas."
  });
});

test("removeStay rejects duplicate ids without changing state", () => {
  const state = {
    version: 1,
    profile: null,
    stays: [createdStay, { ...createdStay }]
  };
  const before = structuredClone(state);

  const result = removeStay(state, "stay-1");

  assert.deepEqual(result, {
    ok: false,
    fieldErrors: {},
    message: "Vistelsen kunde inte hanteras eftersom datan innehåller dubbletter."
  });
  assert.deepEqual(state, before);
});
