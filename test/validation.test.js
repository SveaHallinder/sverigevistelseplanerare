import assert from "node:assert/strict";
import test from "node:test";
import * as validation from "../src/domain/validation.js";

const {
  CHECKLIST_KEYS,
  TRI_STATE,
  validateAppState,
  validateProfile,
  validateStayInput
} = validation;

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

const validStay = {
  arrivalDate: "2026-08-01",
  departureDate: "2026-08-03",
  status: "planned"
};

const validStoredStay = {
  id: "stay-1",
  ...validStay,
  createdAt: "2026-08-16T12:00:00.000Z",
  updatedAt: "2026-08-16T12:00:00.000Z"
};

test("validation exports only the documented API", () => {
  assert.deepEqual(Object.keys(validation).sort(), [
    "CHECKLIST_KEYS",
    "TRI_STATE",
    "validateAppState",
    "validateProfile",
    "validateStayInput"
  ]);
  assert.deepEqual(TRI_STATE, ["yes", "no", "unanswered"]);
  assert.deepEqual(CHECKLIST_KEYS, [
    "yearRoundHome",
    "spouseOrMinorChildren",
    "businessInSweden",
    "businessInfluence",
    "propertyInSweden",
    "otherStrongTies",
    "workDuringStays"
  ]);
});

test("validation rule collections are immutable", () => {
  assert.equal(Object.isFrozen(TRI_STATE), true);
  assert.equal(Object.isFrozen(CHECKLIST_KEYS), true);
});

test("validateProfile returns a normalized copy without mutating its input", () => {
  const input = {
    ...validProfile,
    budgetDays: "90",
    connectionChecklist: { ...validProfile.connectionChecklist },
    ignored: "not persisted"
  };
  const before = structuredClone(input);

  const result = validateProfile(input);

  assert.deepEqual(result, { ok: true, value: validProfile });
  assert.deepEqual(input, before);
  assert.notEqual(result.value, input);
  assert.notEqual(result.value.connectionChecklist, input.connectionChecklist);
});

test("validateProfile normalizes blank tri-state answers to unanswered", () => {
  const input = {
    ...validProfile,
    swedishCitizen: undefined,
    livedInSwedenTenYears: null,
    connectionChecklist: {
      yearRoundHome: "",
      spouseOrMinorChildren: null
    }
  };
  const before = structuredClone(input);

  const result = validateProfile(input);

  assert.equal(result.ok, true);
  assert.equal(result.value.swedishCitizen, "unanswered");
  assert.equal(result.value.livedInSwedenTenYears, "unanswered");
  assert.deepEqual(
    result.value.connectionChecklist,
    Object.fromEntries(CHECKLIST_KEYS.map((key) => [key, "unanswered"]))
  );
  assert.deepEqual(input, before);
});

test("validateProfile rejects invalid profile dates with field-specific copy", () => {
  const result = validateProfile({
    ...validProfile,
    departureDate: "2026-02-29",
    periodStart: "not-a-date",
    periodEnd: "2026-13-01"
  });

  assert.deepEqual(result, {
    ok: false,
    fieldErrors: {
      departureDate: "Ange ett giltigt utflyttningsdatum.",
      periodStart: "Ange ett giltigt startdatum.",
      periodEnd: "Ange ett giltigt slutdatum."
    },
    message: "Kontrollera de markerade fälten."
  });
});

test("validateProfile rejects non-positive, decimal and oversized budgets", async (context) => {
  const cases = [
    [0, "Dagbudgeten måste vara ett heltal på minst 1."],
    [1.5, "Dagbudgeten måste vara ett heltal på minst 1."],
    [366, "Dagbudgeten kan inte vara större än budgetperioden."]
  ];

  for (const [budgetDays, expected] of cases) {
    await context.test(String(budgetDays), () => {
      const result = validateProfile({ ...validProfile, budgetDays });
      assert.equal(result.ok, false);
      assert.equal(result.fieldErrors.budgetDays, expected);
      assert.equal(result.message, "Kontrollera de markerade fälten.");
    });
  }
});

test("validateProfile rejects permissive budget coercions", async (context) => {
  const cases = [
    ["boolean", true],
    ["array", [90]],
    ["object", { valueOf: () => 90 }],
    ["whitespace", " 90 "],
    ["exponent", "9e1"],
    ["hex", "0x5a"]
  ];

  for (const [name, budgetDays] of cases) {
    await context.test(name, () => {
      const result = validateProfile({ ...validProfile, budgetDays });
      assert.equal(result.ok, false);
      assert.equal(
        result.fieldErrors.budgetDays,
        "Dagbudgeten måste vara ett heltal på minst 1."
      );
    });
  }
});

test("validateProfile rejects a reversed budget period", () => {
  const result = validateProfile({
    ...validProfile,
    periodStart: "2026-08-17",
    periodEnd: "2026-08-16"
  });

  assert.deepEqual(result, {
    ok: false,
    fieldErrors: {
      periodEnd: "Slutdatum måste vara samma dag eller senare än startdatum."
    },
    message: "Kontrollera de markerade fälten."
  });
});

test("validateProfile reports invalid tri-state answers beside their fields", () => {
  const result = validateProfile({
    ...validProfile,
    swedishCitizen: "maybe",
    connectionChecklist: {
      ...validProfile.connectionChecklist,
      propertyInSweden: "unknown"
    }
  });

  assert.deepEqual(result, {
    ok: false,
    fieldErrors: {
      swedishCitizen: "Välj ja, nej eller obesvarad.",
      "connectionChecklist.propertyInSweden": "Välj ja, nej eller obesvarad."
    },
    message: "Kontrollera de markerade fälten."
  });
});

test("validateStayInput accepts inclusive actual and planned intervals", () => {
  assert.deepEqual(validateStayInput(validStay), { ok: true, value: validStay });
  assert.deepEqual(validateStayInput({
    arrivalDate: "2026-08-03",
    departureDate: "2026-08-03",
    status: "actual"
  }), {
    ok: true,
    value: {
      arrivalDate: "2026-08-03",
      departureDate: "2026-08-03",
      status: "actual"
    }
  });
});

test("validateStayInput rejects invalid dates with field-specific copy", () => {
  const result = validateStayInput({
    arrivalDate: "2026-02-29",
    departureDate: "tomorrow",
    status: "planned"
  });

  assert.deepEqual(result, {
    ok: false,
    fieldErrors: {
      arrivalDate: "Ange ett giltigt ankomstdatum.",
      departureDate: "Ange ett giltigt avresedatum."
    },
    message: "Kontrollera de markerade fälten."
  });
});

test("validateStayInput rejects reversed dates", () => {
  const result = validateStayInput({
    arrivalDate: "2026-08-04",
    departureDate: "2026-08-03",
    status: "planned"
  });

  assert.deepEqual(result, {
    ok: false,
    fieldErrors: {
      departureDate: "Avresedatum måste vara samma dag eller senare än ankomstdatum."
    },
    message: "Kontrollera de markerade fälten."
  });
});

test("validateStayInput rejects statuses outside actual and planned", () => {
  const result = validateStayInput({ ...validStay, status: "draft" });

  assert.deepEqual(result, {
    ok: false,
    fieldErrors: { status: "Välj faktisk eller planerad vistelse." },
    message: "Kontrollera de markerade fälten."
  });
});

test("validateAppState normalizes and whitelists valid saved data", () => {
  const input = {
    version: 1,
    profile: { ...validProfile, extraProfileField: true },
    stays: [{ ...validStoredStay, extraStayField: true }],
    extraStateField: true
  };
  const before = structuredClone(input);

  const result = validateAppState(input);

  assert.deepEqual(result, {
    ok: true,
    value: {
      version: 1,
      profile: validProfile,
      stays: [validStoredStay]
    }
  });
  assert.deepEqual(input, before);
  assert.notEqual(result.value, input);
  assert.notEqual(result.value.profile, input.profile);
  assert.notEqual(result.value.stays, input.stays);
  assert.notEqual(result.value.stays[0], input.stays[0]);
  assert.deepEqual(validateAppState({ version: 1, profile: null, stays: [] }), {
    ok: true,
    value: { version: 1, profile: null, stays: [] }
  });
});

test("validateAppState rejects unsupported versions and structures", () => {
  for (const input of [null, {}, { version: 2, profile: null, stays: [] }, {
    version: 1,
    profile: null,
    stays: {}
  }]) {
    assert.deepEqual(validateAppState(input), {
      ok: false,
      fieldErrors: {},
      message: "Den sparade datan har en version eller struktur som inte stöds."
    });
  }
});

test("validateAppState rejects an invalid saved profile", () => {
  const result = validateAppState({
    version: 1,
    profile: { ...validProfile, budgetDays: 0 },
    stays: []
  });

  assert.deepEqual(result, {
    ok: false,
    fieldErrors: {
      budgetDays: "Dagbudgeten måste vara ett heltal på minst 1."
    },
    message: "Den sparade profilen är ogiltig."
  });
});

test("validateAppState rejects invalid stay data and metadata", async (context) => {
  const cases = [
    { ...validStoredStay, id: "" },
    { ...validStoredStay, id: 1 },
    { ...validStoredStay, createdAt: "not-a-timestamp" },
    { ...validStoredStay, updatedAt: "not-a-timestamp" },
    { ...validStoredStay, arrivalDate: "invalid" }
  ];

  for (const [index, stay] of cases.entries()) {
    await context.test(String(index), () => {
      assert.deepEqual(validateAppState({ version: 1, profile: null, stays: [stay] }), {
        ok: false,
        fieldErrors: {},
        message: "En sparad vistelse är ogiltig."
      });
    });
  }
});

test("validateAppState accepts only canonical UTC ISO stay timestamps", async (context) => {
  const cases = [
    ["createdAt", 0],
    ["createdAt", "2026-08-16"],
    ["createdAt", "08/16/2026, 12:00:00"],
    ["createdAt", "2026-02-29T12:00:00.000Z"],
    ["createdAt", "2026-08-16T12:00:00.000+00:00"],
    ["updatedAt", "2026-08-16T12:00:00Z"],
    ["updatedAt", "2026-08-16T12:00:00.000"]
  ];

  for (const [field, value] of cases) {
    await context.test(field + ": " + String(value), () => {
      const stay = { ...validStoredStay, [field]: value };
      assert.deepEqual(validateAppState({ version: 1, profile: null, stays: [stay] }), {
        ok: false,
        fieldErrors: {},
        message: "En sparad vistelse är ogiltig."
      });
    });
  }
});

test("validateAppState rejects stay metadata updated before it was created", () => {
  const stay = {
    ...validStoredStay,
    createdAt: "2026-08-16T12:00:00.000Z",
    updatedAt: "2026-08-16T11:59:59.999Z"
  };

  assert.deepEqual(validateAppState({ version: 1, profile: null, stays: [stay] }), {
    ok: false,
    fieldErrors: {},
    message: "En sparad vistelse är ogiltig."
  });
});

test("validateAppState rejects duplicate stay ids", () => {
  const duplicate = {
    ...validStoredStay,
    arrivalDate: "2026-09-01",
    departureDate: "2026-09-02"
  };

  assert.deepEqual(validateAppState({
    version: 1,
    profile: null,
    stays: [validStoredStay, duplicate]
  }), {
    ok: false,
    fieldErrors: {},
    message: "En sparad vistelse är ogiltig."
  });
});

test("validateAppState rejects stays without a profile", () => {
  const result = validateAppState({
    version: 1,
    profile: null,
    stays: [{
      id: "hidden-stay",
      arrivalDate: "2026-08-01",
      departureDate: "2026-08-01",
      status: "actual",
      createdAt: "2026-08-01T12:00:00.000Z",
      updatedAt: "2026-08-01T12:00:00.000Z"
    }]
  });

  assert.deepEqual(result, {
    ok: false,
    fieldErrors: {},
    message: "Sparad data utan profil får inte innehålla vistelser."
  });
});
