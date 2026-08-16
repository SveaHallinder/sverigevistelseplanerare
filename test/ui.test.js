import assert from "node:assert/strict";
import test from "node:test";
import { createDemoState } from "../src/demo-state.js";
import { CHECKLIST_KEYS } from "../src/domain/validation.js";
import { CHECKLIST_CONTENT } from "../src/legal-content.js";
import { serializeAppState } from "../src/storage.js";
import { readProfileForm, renderOnboarding } from "../src/ui/onboarding.js";

function render(overrides = {}) {
  return renderOnboarding({
    defaultYear: "2026",
    ...overrides
  });
}

test("renderOnboarding explains its scope and labels the required profile fields", () => {
  const html = render();

  assert.match(html, /Planeringsverktyg, inte juridisk rådgivning/);
  assert.match(html, /<label for="departureDate">Utflyttningsdatum<\/label>/);
  assert.match(html, /<label for="budgetDays">Personlig dagbudget<\/label>/);
  assert.match(html, /<label for="periodStart">Period från<\/label>/);
  assert.match(html, /<label for="periodEnd">Period till<\/label>/);
  assert.match(html, /data-action="show-demo"/);
  assert.match(html, /Visa syntetiskt demoexempel/);
});

test("renderOnboarding includes every voluntary legal observation question", () => {
  const html = render();

  assert.match(html, /Frivilliga frågor för juridiska observationer/);
  assert.match(html, /Är du svensk medborgare\?/);
  assert.match(html, /minst tio år\?/);
  for (const key of CHECKLIST_KEYS) {
    assert.match(html, new RegExp(CHECKLIST_CONTENT[key].label.replace(/[?]/g, "\\?")));
    assert.match(html, new RegExp('name="connectionChecklist\\.' + key + '"'));
  }
  assert.equal((html.match(/Vill inte svara nu/g) ?? []).length, CHECKLIST_KEYS.length + 2);
});

test("renderOnboarding associates input and tri-state errors with their fields", () => {
  const html = render({
    fieldErrors: {
      departureDate: "Ange ett giltigt utflyttningsdatum.",
      swedishCitizen: "Välj ett svar.",
      "connectionChecklist.propertyInSweden": "Välj ja, nej eller obesvarad."
    }
  });

  assert.match(
    html,
    /name="departureDate"[^>]*aria-invalid="true"[^>]*aria-describedby="departureDate-error"/
  );
  assert.match(html, /id="departureDate-error"[^>]*>Ange ett giltigt utflyttningsdatum\./);
  assert.match(
    html,
    /<fieldset[^>]*aria-invalid="true"[^>]*aria-describedby="swedishCitizen-error"/
  );
  assert.match(html, /id="swedishCitizen-error"[^>]*>Välj ett svar\./);
  assert.match(
    html,
    /<fieldset[^>]*aria-invalid="true"[^>]*aria-describedby="connectionChecklist\.propertyInSweden-error"/
  );
  assert.match(
    html,
    /id="connectionChecklist\.propertyInSweden-error"[^>]*>Välj ja, nej eller obesvarad\./
  );
  assert.match(html, /class="error-summary" role="alert"/);
});

test("renderOnboarding shows a storage warning without adding travel dates to its banner", () => {
  const html = render({
    storageIssue: {
      code: "memory-fallback",
      message: "Data försvinner när sidan laddas om."
    }
  });
  const banner = html.match(/<p class="storage-warning"[^>]*>(.*?)<\/p>/)?.[1];

  assert.equal(banner, "Data försvinner när sidan laddas om.");
  assert.doesNotMatch(banner, /\d{4}-\d{2}-\d{2}/);
});

test("renderOnboarding uses editing actions without exposing the demo action", () => {
  const html = render({ editing: true });

  assert.match(html, /Spara ändringar/);
  assert.match(html, /data-action="cancel-edit-profile"/);
  assert.doesNotMatch(html, /data-action="show-demo"/);
});

test("renderOnboarding escapes profile values, field errors and storage messages", () => {
  const attributePayload = '\"><img src=x onerror="alert(1)">';
  const html = render({
    profile: {
      departureDate: attributePayload,
      budgetDays: 90,
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      swedishCitizen: "unanswered",
      livedInSwedenTenYears: "unanswered",
      connectionChecklist: {}
    },
    fieldErrors: {
      departureDate: "<strong>Kontrollera datumet</strong>"
    },
    storageIssue: {
      message: "<img src=x onerror=alert(2)>"
    }
  });

  assert.doesNotMatch(html, /<img|<strong>/);
  assert.match(html, /value="&quot;&gt;&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;"/);
  assert.match(html, /&lt;strong&gt;Kontrollera datumet&lt;\/strong&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(2\)&gt;/);
});

test("readProfileForm returns the profile contract and defaults unanswered radios", () => {
  const NativeFormData = globalThis.FormData;
  const fields = {
    departureDate: "2025-02-15",
    budgetDays: "90",
    periodStart: "2026-01-01",
    periodEnd: "2026-12-31",
    swedishCitizen: "yes",
    "connectionChecklist.propertyInSweden": "no"
  };
  globalThis.FormData = class FormDataStub {
    constructor(form) {
      this.form = form;
    }

    get(name) {
      return this.form[name] ?? null;
    }
  };

  try {
    const profile = readProfileForm(fields);

    assert.deepEqual(profile, {
      departureDate: "2025-02-15",
      budgetDays: 90,
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      swedishCitizen: "yes",
      livedInSwedenTenYears: "unanswered",
      connectionChecklist: Object.fromEntries(CHECKLIST_KEYS.map((key) => [
        key,
        key === "propertyInSweden" ? "no" : "unanswered"
      ]))
    });
  } finally {
    globalThis.FormData = NativeFormData;
  }
});

test("createDemoState returns fixed current-year synthetic data", () => {
  const state = createDemoState("2026-08-16");

  assert.equal(state.demo, true);
  assert.deepEqual(state.profile, {
    departureDate: "2025-02-15",
    budgetDays: 90,
    periodStart: "2026-01-01",
    periodEnd: "2026-12-31",
    swedishCitizen: "yes",
    livedInSwedenTenYears: "unanswered",
    connectionChecklist: Object.fromEntries(
      CHECKLIST_KEYS.map((key) => [key, "unanswered"])
    )
  });
  assert.deepEqual(state.stays.map(({ id, arrivalDate, departureDate, status }) => ({
    id,
    arrivalDate,
    departureDate,
    status
  })), [
    {
      id: "demo-april",
      arrivalDate: "2026-04-02",
      departureDate: "2026-04-09",
      status: "actual"
    },
    {
      id: "demo-june",
      arrivalDate: "2026-06-18",
      departureDate: "2026-06-28",
      status: "actual"
    },
    {
      id: "demo-august",
      arrivalDate: "2026-08-05",
      departureDate: "2026-08-12",
      status: "planned"
    }
  ]);
  for (const stay of state.stays) {
    assert.match(stay.createdAt, /^2026-\d{2}-\d{2}T12:00:00\.000Z$/);
    assert.equal(stay.updatedAt, stay.createdAt);
  }
});

test("serializeAppState rejects the synthetic demo state", () => {
  assert.throws(
    () => serializeAppState(createDemoState("2026-08-16")),
    /Demoexemplet får inte sparas/
  );
});
