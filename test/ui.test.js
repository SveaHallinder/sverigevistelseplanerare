import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createDemoState } from "../src/demo-state.js";
import { CHECKLIST_KEYS } from "../src/domain/validation.js";
import { CHECKLIST_CONTENT } from "../src/legal-content.js";
import { serializeAppState } from "../src/storage.js";
import { readProfileForm, renderOnboarding } from "../src/ui/onboarding.js";

const cockpitModule = await import("../src/ui/cockpit.js").catch(() => ({}));
const dataToolsModule = await import("../src/ui/data-tools.js").catch(() => ({}));
const observationsModule = await import("../src/ui/observations.js").catch(() => ({}));
const stayDialogModule = await import("../src/ui/stay-dialog.js").catch(() => ({}));
const mainModule = await import("../src/main.js").catch(() => ({}));
const { buildCockpitModel, renderCockpit, renderYearCalendar } = cockpitModule;
const { renderDataTools } = dataToolsModule;
const { renderObservations } = observationsModule;
const {
  closeStayDialog,
  openStayDialog,
  readStayForm,
  renderStayDialog
} = stayDialogModule;
const { createBrowserApp } = mainModule;

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

  assert.match(banner, /Data kan försvinna när sidan stängs/);
  assert.match(banner, /Data försvinner när sidan laddas om/);
  assert.doesNotMatch(banner, /\d{4}-\d{2}-\d{2}/);
});

test("renderOnboarding presents unsupported storage as a blocking clear flow", () => {
  const issue = {
    code: "unsupported-version",
    message: "Den sparade dataversionen stöds inte. Datan har inte skrivits över."
  };
  const initial = render({ storageIssue: issue });
  const requested = render({ storageIssue: issue, clearRequested: true });

  assert.match(initial, /class="storage-warning" role="alert"/);
  assert.match(initial, /data-action="request-clear"/);
  assert.match(initial, /type="submit"[^>]*disabled/);
  assert.match(requested, /profilen och alla registrerade vistelser tas bort/);
  assert.match(requested, /data-action="confirm-clear"/);
  assert.match(requested, /data-action="cancel-clear"/);
});

test("session and memory presentation keeps the shared closing warning and precise detail", () => {
  const sessionHtml = render({
    storageIssue: {
      code: "session-fallback",
      message: "Sessionslagring används för den här fliken."
    }
  });
  const memoryHtml = render({
    storageIssue: {
      code: "memory-fallback",
      message: "Data försvinner när sidan laddas om."
    }
  });

  for (const html of [sessionHtml, memoryHtml]) {
    assert.match(html, /Data kan försvinna när sidan stängs/);
  }
  assert.match(sessionHtml, /Sessionslagring används för den här fliken/);
  assert.match(memoryHtml, /Data försvinner när sidan laddas om/);
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

function cockpitState(overrides = {}) {
  const unansweredChecklist = Object.fromEntries(
    CHECKLIST_KEYS.map((key) => [key, "unanswered"])
  );
  return {
    version: 1,
    profile: {
      departureDate: "2025-02-15",
      budgetDays: 5,
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      swedishCitizen: "no",
      livedInSwedenTenYears: "no",
      connectionChecklist: unansweredChecklist,
      ...overrides.profile
    },
    stays: overrides.stays ?? [
      {
        id: "actual-august",
        arrivalDate: "2026-08-01",
        departureDate: "2026-08-02",
        status: "actual",
        createdAt: "2026-07-31T12:00:00.000Z",
        updatedAt: "2026-07-31T12:00:00.000Z"
      },
      {
        id: "planned-august",
        arrivalDate: "2026-08-02",
        departureDate: "2026-08-06",
        status: "planned",
        createdAt: "2026-07-31T12:00:00.000Z",
        updatedAt: "2026-07-31T12:00:00.000Z"
      }
    ]
  };
}

function requireCockpitApi() {
  assert.equal(typeof buildCockpitModel, "function", "buildCockpitModel ska exporteras");
  assert.equal(typeof renderCockpit, "function", "renderCockpit ska exporteras");
  assert.equal(typeof renderYearCalendar, "function", "renderYearCalendar ska exporteras");
}

test("cockpit exports its model and rendering API", () => {
  requireCockpitApi();
  assert.equal(typeof renderObservations, "function", "renderObservations ska exporteras");
});

test("buildCockpitModel preserves actual precedence and calculates overlap-aware KPIs", () => {
  requireCockpitApi();
  const model = buildCockpitModel(cockpitState(), {
    today: "2026-08-16",
    year: 2026
  });

  assert.equal(model.budget.actualDays, 2);
  assert.equal(model.budget.plannedDays, 5);
  assert.equal(model.budget.uniqueDays, 6);
  assert.equal(model.budget.overBy, 1);
  assert.equal(model.budget.lastWithinBudgetDate, "2026-08-05");
  assert.equal(model.statusByDate["2026-08-02"], "actual");
  assert.equal(model.explanation.totals.overlapDays, 1);
  assert.equal(model.explanation.boundary.firstExceededDate, "2026-08-06");
});

test("renderCockpit explains registered-day boundaries without legal certainty", () => {
  const model = buildCockpitModel(cockpitState({
    profile: { budgetDays: 5 },
    stays: [
      {
        id: "actual",
        arrivalDate: "2026-08-01",
        departureDate: "2026-08-02",
        status: "actual",
        createdAt: "2026-08-01T12:00:00.000Z",
        updatedAt: "2026-08-01T12:00:00.000Z"
      },
      {
        id: "planned",
        arrivalDate: "2026-08-02",
        departureDate: "2026-08-06",
        status: "planned",
        createdAt: "2026-08-01T12:00:00.000Z",
        updatedAt: "2026-08-01T12:00:00.000Z"
      }
    ]
  }), { today: "2026-08-16" });

  const html = renderCockpit(model);

  assert.match(html, /Så räknas planen/);
  assert.match(html, /Första registrerade dag över budget/);
  assert.match(html, /6 augusti 2026/);
  assert.match(html, /Ankomst- och avresedag räknas/);
  assert.match(html, /överlappande datum räknas en gång/);
  assert.match(html, /Faktisk historik/);
  assert.match(html, /Faktisk plus planerad/);
  assert.match(html, /personliga budget, inte en juridisk gräns/);
  assert.doesNotMatch(html, /säker|laglig|måste lämna/i);
});

test("renderCockpit uses singular day copy in the calculation disclosure", () => {
  const overByOne = renderCockpit(buildCockpitModel(cockpitState({
    profile: { budgetDays: 5 }
  }), { today: "2026-08-16" }));
  const remainingOne = renderCockpit(buildCockpitModel(cockpitState({
    profile: { budgetDays: 7 }
  }), { today: "2026-08-16" }));

  assert.match(overByOne, /1 dag över den personliga budgeten/);
  assert.doesNotMatch(overByOne, /1 dagar över den personliga budgeten/);
  assert.match(remainingOne, /1 dag kvar i den personliga budgeten/);
  assert.doesNotMatch(remainingOne, /1 dagar kvar i den personliga budgeten/);
});

test("renderCockpit explains budget boundary and statuses with more than colour", () => {
  requireCockpitApi();
  const html = renderCockpit(buildCockpitModel(cockpitState(), {
    today: "2026-08-16",
    year: 2026,
    focusedDate: "2026-08-02"
  }));

  assert.match(html, /Senaste registrerade dag inom budget: 5 augusti 2026/);
  assert.match(html, /Planen ligger 1 dag över din personliga budget/);
  assert.match(html, /Faktiska dagar/);
  assert.match(html, /Planerade dagar/);
  assert.match(html, /class="legend[^>]*>[\s\S]*Faktisk[\s\S]*Planerad[\s\S]*Inte registrerad/);
  assert.match(
    html,
    /data-date="2026-08-02"[^>]*data-status="actual"[^>]*aria-label="2 augusti 2026, faktisk vistelse"/
  );
  assert.match(html, /class="budget-meter"[^>]*role="progressbar"/);
});

test("renderYearCalendar has seven weekday headers per month and one roving tab stop", () => {
  requireCockpitApi();
  const model = buildCockpitModel(cockpitState(), {
    today: "2026-08-16",
    year: 2026,
    focusedDate: "2025-12-31"
  });
  const html = renderYearCalendar(model);

  assert.equal((html.match(/<th scope="col">/g) ?? []).length, 12 * 7);
  assert.equal((html.match(/<table aria-labelledby="month-/g) ?? []).length, 12);
  assert.match(
    html,
    /Måndag[\s\S]*Tisdag[\s\S]*Onsdag[\s\S]*Torsdag[\s\S]*Fredag[\s\S]*Lördag[\s\S]*Söndag/
  );
  assert.equal((html.match(/tabindex="0"/g) ?? []).length, 1);
  assert.match(html, /data-date="2026-01-01"[^>]*tabindex="0"/);
  assert.match(html, /calendar-day__marker/);
});

test("renderCockpit shows an actionable empty state outside demo", () => {
  requireCockpitApi();
  const html = renderCockpit(buildCockpitModel(cockpitState({ stays: [] }), {
    today: "2026-08-16",
    year: 2026
  }));

  assert.match(html, /Inga Sverigedagar registrerade/);
  assert.match(html, /Omarkerade dagar är inte registrerade/);
  assert.match(html, /data-action="add-stay"/);
});

test("renderCockpit offers confirmation for a past planned stay", () => {
  requireCockpitApi();
  const html = renderCockpit(buildCockpitModel(cockpitState(), {
    today: "2026-08-16",
    year: 2026
  }));

  assert.match(html, /data-action="confirm-actual" data-stay-id="planned-august"/);
  assert.match(html, /class="stay-row stay-row--planned"[^>]*data-action="edit-stay"/);
  assert.match(html, /Genomfördes den här planerade vistelsen\?/);
  assert.match(html, /Ja, markera som genomförd/);
  assert.equal(cockpitState().stays[1].status, "planned");
});

test("renderCockpit reports merged excluded date ranges neutrally", () => {
  requireCockpitApi();
  const state = cockpitState({
    profile: {
      periodStart: "2026-08-02",
      periodEnd: "2026-08-04"
    },
    stays: [{
      id: "partly-excluded",
      arrivalDate: "2026-07-30",
      departureDate: "2026-08-06",
      status: "actual",
      createdAt: "2026-07-29T12:00:00.000Z",
      updatedAt: "2026-07-29T12:00:00.000Z"
    }]
  });
  const html = renderCockpit(buildCockpitModel(state, {
    today: "2026-08-16",
    year: 2026
  }));

  assert.match(
    html,
    /class="budget-status__excluded">5 registrerade dagar ligger utanför budgetperioden och räknas inte:/
  );
  assert.match(html, /class="edge-range">30 juli 2026–1 augusti 2026<\/span>/);
  assert.match(html, /class="edge-range">5 augusti 2026–6 augusti 2026<\/span>/);
  assert.doesNotMatch(html, /budget-status__excluded[^>]*validation|budget-status__excluded[^>]*danger/);
});

test("renderCockpit uses an inline clear confirmation and fallback warning copy", () => {
  requireCockpitApi();
  const model = buildCockpitModel(cockpitState(), {
    today: "2026-08-16",
    year: 2026,
    clearRequested: true,
    storageIssue: {
      code: "memory-fallback",
      message: "Data försvinner när sidan laddas om."
    }
  });
  const html = renderCockpit(model);

  assert.match(html, /Data kan försvinna när sidan stängs/);
  assert.match(html, /Data försvinner när sidan laddas om/);
  assert.match(html, /profilen och alla registrerade vistelser tas bort/);
  assert.match(html, /data-action="confirm-clear"/);
  assert.match(html, /data-action="cancel-clear"/);
});

test("renderCockpit gives every legal observation evidence, source and review date", () => {
  requireCockpitApi();
  const model = buildCockpitModel(cockpitState(), {
    today: "2026-08-16",
    year: 2026
  });
  const html = renderCockpit(model);

  for (const observation of model.observations) {
    assert.ok(html.includes(observation.title));
    assert.ok(observation.evidence.every((item) => html.includes(item)));
    assert.match(html, new RegExp('data-observation-id="' + observation.id + '"'));
    assert.match(html, /target="_blank" rel="noopener noreferrer"/);
    assert.ok(html.includes("Senast granskad " + observation.reviewedAt));
  }
});

test("renderCockpit demo exposes only exit-demo among mutating actions", () => {
  requireCockpitApi();
  const html = renderCockpit(buildCockpitModel(cockpitState(), {
    today: "2026-08-16",
    year: 2026,
    demo: true
  }));

  assert.match(html, /Syntetiskt demoexempel/);
  assert.match(html, /data-action="exit-demo"/);
  assert.doesNotMatch(html, /data-action="(?:add-stay|edit-stay|confirm-actual|request-clear)"/);
});

test("cockpit and observation renderers escape all dynamic content", () => {
  requireCockpitApi();
  assert.equal(typeof renderObservations, "function");
  const payload = '"><img src=x onerror="alert(1)">';
  const state = cockpitState({
    stays: [{
      ...cockpitState().stays[0],
      id: payload,
      status: payload
    }]
  });
  const model = buildCockpitModel(state, {
    today: "2026-08-16",
    year: 2026,
    storageIssue: { message: payload }
  });
  model.budget.actualDays = payload;
  model.profile = { ...model.profile, budgetDays: payload };
  const cockpitHtml = renderCockpit(model);
  const observationHtml = renderObservations([{
    id: payload,
    level: payload,
    scope: "actual",
    title: payload,
    summary: payload,
    evidence: [payload],
    sourceId: "unsafe",
    reviewedAt: payload
  }], {
    unsafe: { title: payload, url: payload, reviewedAt: payload }
  });

  assert.doesNotMatch(cockpitHtml, /<img/);
  assert.doesNotMatch(observationHtml, /<img/);
  assert.ok(cockpitHtml.includes("&quot;&gt;&lt;img"));
  assert.ok(observationHtml.includes("&quot;&gt;&lt;img"));
  assert.match(observationHtml, /href="&quot;&gt;&lt;img/);
});

test("cockpit CSS keeps calendar responsive and status markers non-colour-only", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(css, /\.year-calendar\s*\{[^}]*grid-template-columns:\s*repeat\(3,/s);
  assert.match(css, /@media \(max-width:\s*61\.25rem\)[\s\S]*repeat\(2,/);
  assert.match(css, /@media \(max-width:\s*39\.9375rem\)[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(css, /\.calendar-day--actual \.calendar-day__marker/);
  assert.match(css, /\.calendar-day--planned \.calendar-day__marker/);
  assert.match(css, /\.month-card\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.month-card table\s*\{[^}]*min-width:\s*19\.25rem/s);
  assert.match(
    css,
    /@media \(max-width:\s*90rem\)\s*\{[^}]*\.cockpit-layout\s*\{[^}]*grid-template-columns:\s*1fr/s
  );
  assert.match(css, /\.stay-row--planned/);
  assert.match(css, /\.observation a\s*\{[^}]*min-height:\s*2\.75rem/s);
  assert.match(css, /\.inline-confirm\s*\{/);
  assert.match(css, /\.edge-ranges\s*\{/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
});

function requireStayDialogApi() {
  assert.equal(typeof renderStayDialog, "function", "renderStayDialog ska exporteras");
  assert.equal(typeof openStayDialog, "function", "openStayDialog ska exporteras");
  assert.equal(typeof closeStayDialog, "function", "closeStayDialog ska exporteras");
  assert.equal(typeof readStayForm, "function", "readStayForm ska exporteras");
}

function stayDialogModel(overrides = {}) {
  return {
    mode: overrides.mode ?? "create",
    values: {
      arrivalDate: "2026-08-20",
      departureDate: "2026-08-22",
      status: "planned",
      ...overrides.values
    },
    fieldErrors: overrides.fieldErrors ?? {},
    message: overrides.message ?? "",
    preview: Object.hasOwn(overrides, "preview")
      ? overrides.preview
      : {
          uniqueDays: 8,
          budgetDays: 90,
          remaining: 82,
          candidateLastWithinBudgetDate: "2026-08-22",
          candidateFirstExceededDate: null
        },
    deleteRequested: overrides.deleteRequested ?? false
  };
}

test("renderStayDialog renders a labelled create form and inclusive preview", () => {
  requireStayDialogApi();
  const html = renderStayDialog(stayDialogModel());

  assert.match(html, /<h2 id="stay-dialog-title">Lägg till vistelse<\/h2>/);
  assert.match(html, /data-form="stay"/);
  assert.match(html, /<label for="stay-arrivalDate">Ankomstdatum<\/label>/);
  assert.match(html, /<label for="stay-departureDate">Avresedatum<\/label>/);
  assert.match(html, /Ankomst- och avresedag räknas inkluderande/);
  assert.match(html, /name="status" value="actual"/);
  assert.match(html, /name="status" value="planned" checked/);
  assert.match(html, /Efter vistelsen/);
  assert.match(html, /8 \/ 90 registrerade dagar/);
  assert.doesNotMatch(html, /data-action="request-delete"/);
});

test("renderStayDialog uses singular copy for one day over budget", () => {
  requireStayDialogApi();
  const html = renderStayDialog(stayDialogModel({
    preview: {
      uniqueDays: 91,
      budgetDays: 90,
      remaining: -1,
      candidateLastWithinBudgetDate: null,
      candidateFirstExceededDate: "2026-08-22"
    }
  }));

  assert.match(html, /1 dag över din personliga budget/);
  assert.doesNotMatch(html, /1 dagar över din personliga budget/);
});

test("renderStayDialog renders edit values before an explicit delete request", () => {
  requireStayDialogApi();
  const html = renderStayDialog(stayDialogModel({
    mode: "edit",
    values: {
      arrivalDate: "2026-07-01",
      departureDate: "2026-07-03",
      status: "actual"
    }
  }));

  assert.match(html, /<h2 id="stay-dialog-title">Redigera vistelse<\/h2>/);
  assert.match(html, /name="arrivalDate"[^>]*value="2026-07-01"/);
  assert.match(html, /name="status" value="actual" checked/);
  assert.match(html, /data-action="request-delete"/);
  assert.doesNotMatch(html, /data-action="confirm-delete"/);
});

test("renderStayDialog associates escaped field errors and requires delete confirmation", () => {
  requireStayDialogApi();
  const payload = '\"><img src=x onerror="alert(1)">';
  const html = renderStayDialog(stayDialogModel({
    mode: "edit",
    values: {
      arrivalDate: payload,
      departureDate: "2026-07-03",
      status: payload
    },
    fieldErrors: {
      arrivalDate: "<strong>Kontrollera datumet</strong>",
      status: payload
    },
    message: "<img src=x onerror=alert(2)>",
    preview: null,
    deleteRequested: true
  }));

  assert.doesNotMatch(html, /<img|<strong>/);
  assert.match(html, /name="arrivalDate"[^>]*aria-invalid="true"[^>]*aria-describedby="stay-arrivalDate-error"/);
  assert.match(html, /id="stay-arrivalDate-error"[^>]*>&lt;strong&gt;Kontrollera datumet&lt;\/strong&gt;/);
  assert.match(html, /<fieldset[^>]*aria-invalid="true"[^>]*aria-describedby="stay-status-error"/);
  assert.match(html, /Vill du ta bort vistelsen permanent\?/);
  assert.match(html, /data-action="confirm-delete"/);
  assert.match(html, /data-action="cancel-delete"/);
  assert.doesNotMatch(html, /data-action="request-delete"/);
});

test("openStayDialog focuses arrival and closeStayDialog restores existing focus", () => {
  requireStayDialogApi();
  let arrivalFocuses = 0;
  let returnFocuses = 0;
  const arrival = { focus: () => { arrivalFocuses += 1; } };
  const returnFocus = {
    isConnected: true,
    focus() {
      returnFocuses += 1;
    }
  };
  const dialog = {
    innerHTML: "",
    open: false,
    querySelector: () => arrival,
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    }
  };

  openStayDialog(dialog, stayDialogModel(), returnFocus);
  assert.equal(dialog.open, true);
  assert.equal(arrivalFocuses, 1);
  assert.match(dialog.innerHTML, /data-form="stay"/);

  closeStayDialog(dialog);
  assert.equal(dialog.open, false);
  assert.equal(returnFocuses, 1);

  returnFocus.isConnected = false;
  openStayDialog(dialog, stayDialogModel(), returnFocus);
  closeStayDialog(dialog);
  assert.equal(returnFocuses, 1);
});

test("readStayForm returns only the stay input contract", () => {
  requireStayDialogApi();
  const NativeFormData = globalThis.FormData;
  globalThis.FormData = class FormDataStub {
    constructor(form) {
      this.form = form;
    }

    get(name) {
      return this.form[name] ?? null;
    }
  };

  try {
    assert.deepEqual(readStayForm({
      arrivalDate: "2026-08-20",
      departureDate: "2026-08-22",
      status: "planned",
      ignored: "secret"
    }), {
      arrivalDate: "2026-08-20",
      departureDate: "2026-08-22",
      status: "planned"
    });
  } finally {
    globalThis.FormData = NativeFormData;
  }
});

class FakeEventRoot {
  constructor() {
    this.handlers = new Map();
    this.innerHTML = "";
  }

  addEventListener(type, handler) {
    const handlers = this.handlers.get(type) ?? [];
    handlers.push(handler);
    this.handlers.set(type, handlers);
  }

  dispatch(type, event) {
    for (const handler of this.handlers.get(type) ?? []) {
      handler(event);
    }
  }

  async dispatchAsync(type, event) {
    for (const handler of this.handlers.get(type) ?? []) {
      await handler(event);
    }
  }
}

function actionTarget(action, dataset = {}) {
  return {
    dataset: { action, ...dataset },
    isConnected: true,
    focus() {},
    closest(selector) {
      return selector === "[data-action]" || selector === "[data-date]"
        ? this
        : null;
    }
  };
}

function fakeBrowserDocument() {
  const app = new FakeEventRoot();
  app.focusedSelectors = [];
  app.querySelector = (selector) => {
    app.focusedSelectors.push(selector);
    return { focus() {}, isConnected: true };
  };
  const arrival = { focus() {}, isConnected: true };
  const dialog = new FakeEventRoot();
  dialog.open = false;
  dialog.showModal = function showModal() {
    this.open = true;
  };
  dialog.close = function close() {
    this.open = false;
  };
  dialog.querySelector = (selector) => selector.includes("arrivalDate") ? arrival : null;
  const liveRegion = { textContent: "" };
  const nodes = {
    "#app": app,
    "#stay-dialog": dialog,
    "#live-region": liveRegion
  };
  return {
    app,
    dialog,
    liveRegion,
    documentRef: {
      querySelector(selector) {
        return nodes[selector] ?? null;
      }
    }
  };
}

function browserRepository(initialState, {
  loadIssue = null,
  saveResult = null,
  clearResult = null
} = {}) {
  let state = initialState;
  const calls = { save: [], clear: 0 };
  return {
    calls,
    load() {
      return { state, issue: loadIssue, mode: "local" };
    },
    save(nextState) {
      calls.save.push(nextState);
      if (saveResult && !saveResult.ok) {
        return saveResult;
      }
      state = nextState;
      return saveResult ?? { ok: true, issue: null, mode: "local" };
    },
    clear() {
      calls.clear += 1;
      if (clearResult && !clearResult.ok) {
        return clearResult;
      }
      state = null;
      return clearResult ?? { ok: true, issue: null, mode: "local" };
    }
  };
}

function withFormData(callback) {
  const NativeFormData = globalThis.FormData;
  globalThis.FormData = class FormDataStub {
    constructor(form) {
      this.form = form;
    }

    get(name) {
      return this.form.fields[name] ?? null;
    }
  };
  try {
    return callback();
  } finally {
    globalThis.FormData = NativeFormData;
  }
}

function stayForm(fields) {
  return {
    fields,
    matches(selector) {
      return selector === '[data-form="stay"]';
    },
    closest(selector) {
      return selector === '[data-form="stay"]' ? this : null;
    }
  };
}

function profileForm(fields) {
  return {
    fields,
    matches(selector) {
      return selector === '[data-form="profile"]';
    }
  };
}

function createTestBrowserApp(state = cockpitState(), repositoryOptions = {}) {
  assert.equal(typeof createBrowserApp, "function", "createBrowserApp ska exporteras");
  const browser = fakeBrowserDocument();
  const repository = browserRepository(state, repositoryOptions);
  const windowRef = {
    crypto: { randomUUID: () => "browser-stay" }
  };
  const downloads = [];
  const readFileCalls = [];
  const readFileText = async (file) => {
    readFileCalls.push(file);
    if (file.unreadable) {
      throw new Error("kunde inte läsas");
    }
    return file.contents;
  };
  const downloadFile = (file) => downloads.push(file);
  const api = createBrowserApp({
    documentRef: browser.documentRef,
    windowRef,
    repository,
    today: "2026-08-16",
    now: () => "2026-08-16T12:00:00.000Z",
    makeId: () => "browser-stay",
    readFileText,
    downloadFile
  });
  return {
    ...browser,
    repository,
    windowRef,
    api,
    downloads,
    readFileCalls
  };
}

function restorableAppState() {
  return {
    version: 1,
    profile: {
      departureDate: "2025-02-15",
      budgetDays: 5,
      periodStart: "2027-01-01",
      periodEnd: "2027-12-31",
      swedishCitizen: "no",
      livedInSwedenTenYears: "no",
      connectionChecklist: Object.fromEntries(
        CHECKLIST_KEYS.map((key) => [key, "unanswered"])
      )
    },
    stays: [{
      id: "restored-stay",
      arrivalDate: "2027-03-01",
      departureDate: "2027-03-02",
      status: "actual",
      createdAt: "2026-08-01T12:00:00.000Z",
      updatedAt: "2026-08-01T12:00:00.000Z"
    }]
  };
}

function restoreFile(overrides = {}) {
  const contents = Object.hasOwn(overrides, "contents")
    ? overrides.contents
    : serializeAppState(restorableAppState());
  return {
    name: overrides.name ?? "min-backup.json",
    size: overrides.size ?? contents?.length ?? 0,
    contents,
    unreadable: overrides.unreadable ?? false
  };
}

function restoreInput(file) {
  return {
    value: "C:\\fakepath\\min-backup.json",
    files: file ? [file] : [],
    matches(selector) {
      return selector === '[data-file-input="restore"]';
    }
  };
}

async function chooseRestoreFile(app, file) {
  const input = restoreInput(file);
  await app.dispatchAsync("change", { target: input });
  return input;
}

test("renderDataTools escapes the preview filename and offers explicit actions", () => {
  assert.equal(typeof renderDataTools, "function", "renderDataTools ska exporteras");
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
});

test("renderDataTools hides confirmation without a preview and pluralises stays", () => {
  const withoutPreview = renderDataTools({ canExport: true });
  const twoStays = renderDataTools({
    canExport: true,
    restorePreview: { fileName: "b.json", hasProfile: false, stayCount: 2 }
  });

  assert.doesNotMatch(withoutPreview, /data-action="confirm-restore"/);
  assert.doesNotMatch(withoutPreview, /data-action="cancel-restore"/);
  assert.doesNotMatch(withoutPreview, /Ersätt aktuell data\?/);
  assert.match(withoutPreview, /data-action="choose-restore"/);
  assert.match(twoStays, /2 vistelser/);
  assert.match(twoStays, /Ingen profil/);
});

test("renderDataTools keeps restore but omits downloads without a profile", () => {
  const html = renderDataTools({ canExport: false });

  assert.match(html, /data-action="choose-restore"/);
  assert.match(html, /data-file-input="restore"/);
  assert.doesNotMatch(html, /data-action="download-backup"/);
  assert.doesNotMatch(html, /data-action="download-csv"/);
});

test("main downloads a canonical backup and a CSV without repository writes", () => {
  const state = cockpitState();
  const { app, repository, downloads } = createTestBrowserApp(state);

  app.dispatch("click", { target: actionTarget("download-backup") });
  app.dispatch("click", { target: actionTarget("download-csv") });

  assert.equal(downloads.length, 2);
  assert.deepEqual(downloads[0], {
    filename: "sverigevistelseplaneraren-backup-2026-08-16.json",
    mimeType: "application/json;charset=utf-8",
    content: serializeAppState(state)
  });
  assert.equal(
    downloads[1].filename,
    "sverigevistelseplaneraren-vistelser-2026-08-16.csv"
  );
  assert.equal(downloads[1].mimeType, "text/csv;charset=utf-8");
  assert.equal(
    downloads[1].content,
    "ankomstdatum,avresedatum,status,kalenderdagar\r\n"
      + "2026-08-01,2026-08-02,faktisk,2\r\n"
      + "2026-08-02,2026-08-06,planerad,5\r\n"
  );
  assert.equal(repository.calls.save.length, 0);
});

test("main announces an empty stay list instead of downloading a CSV", () => {
  const { app, liveRegion, downloads } = createTestBrowserApp(
    cockpitState({ stays: [] })
  );

  app.dispatch("click", { target: actionTarget("download-csv") });

  assert.equal(downloads.length, 0);
  assert.equal(liveRegion.textContent, "Det finns inga vistelser att exportera.");
});

test("main rejects an oversized backup before reading it", async () => {
  const { app, liveRegion, readFileCalls, repository } = createTestBrowserApp();

  await chooseRestoreFile(app, restoreFile({ size: 1_048_577 }));

  assert.equal(readFileCalls.length, 0);
  assert.equal(repository.calls.save.length, 0);
  assert.match(liveRegion.textContent, /större än 1 MiB/);
  assert.doesNotMatch(app.innerHTML, /data-action="confirm-restore"/);
});

test("main keeps state and stored bytes when a chosen file is invalid", async () => {
  const state = cockpitState();
  const { app, liveRegion, repository, api } = createTestBrowserApp(state);

  await chooseRestoreFile(app, restoreFile({ contents: "{inte-json" }));

  assert.equal(repository.calls.save.length, 0);
  assert.equal(api.controller.getSnapshot().state, state);
  assert.equal(liveRegion.textContent, "Backupfilen innehåller inte giltig JSON.");
  assert.doesNotMatch(app.innerHTML, /data-action="confirm-restore"/);
});

test("main announces an unreadable file without exposing the caught error", async () => {
  const { app, liveRegion, repository } = createTestBrowserApp();

  await chooseRestoreFile(app, restoreFile({ unreadable: true }));

  assert.equal(repository.calls.save.length, 0);
  assert.equal(
    liveRegion.textContent,
    "Backupfilen kunde inte läsas. Ingen data har ändrats."
  );
});

test("main can restore from onboarding and never saves before confirmation", async () => {
  const { app, repository } = createTestBrowserApp(null);

  assert.match(app.innerHTML, /Planera Sverigedagar/);
  assert.match(app.innerHTML, /data-action="choose-restore"/);
  assert.doesNotMatch(app.innerHTML, /data-action="download-backup"/);

  await chooseRestoreFile(app, restoreFile());

  assert.equal(repository.calls.save.length, 0);
  assert.match(app.innerHTML, /Ersätt aktuell data\?/);
  assert.match(app.innerHTML, /min-backup\.json/);
  assert.match(app.innerHTML, /1 vistelse/);
  assert.match(app.innerHTML, /data-action="confirm-restore"/);
});

test("main cancel-restore preserves state and returns focus to the chooser", async () => {
  const state = cockpitState();
  const { app, repository, api } = createTestBrowserApp(state);
  await chooseRestoreFile(app, restoreFile());

  app.dispatch("click", { target: actionTarget("cancel-restore") });

  assert.equal(repository.calls.save.length, 0);
  assert.equal(api.controller.getSnapshot().state, state);
  assert.doesNotMatch(app.innerHTML, /data-action="confirm-restore"/);
  assert.ok(app.focusedSelectors.includes('[data-action="choose-restore"]'));
});

test("main confirm-restore saves once, replaces state and resets the view year", async () => {
  const { app, repository, api } = createTestBrowserApp(cockpitState());
  await chooseRestoreFile(app, restoreFile());

  app.dispatch("click", { target: actionTarget("confirm-restore") });

  assert.equal(repository.calls.save.length, 1);
  assert.deepEqual(repository.calls.save[0], restorableAppState());
  assert.deepEqual(api.controller.getSnapshot().state, restorableAppState());
  assert.doesNotMatch(app.innerHTML, /data-action="confirm-restore"/);
  assert.match(app.innerHTML, /data-action="next-year" aria-label="Nästa år"/);
  assert.match(app.innerHTML, /<h2>2027<\/h2>/);
  assert.ok(app.focusedSelectors.includes('[data-action="choose-restore"]'));
});

test("main keeps the confirmation visible and warns about partial writes on conflict", async () => {
  const state = cockpitState();
  const conflict = {
    ok: false,
    issue: {
      code: "storage-conflict",
      message: "Sparad data har ändrats. Ladda om först."
    },
    mode: "local"
  };
  const { app, liveRegion, api } = createTestBrowserApp(state, {
    saveResult: conflict
  });
  await chooseRestoreFile(app, restoreFile());

  app.dispatch("click", { target: actionTarget("confirm-restore") });

  assert.equal(api.controller.getSnapshot().state, state);
  assert.match(app.innerHTML, /data-action="confirm-restore"/);
  assert.match(liveRegion.textContent, /kan ha skrivits delvis/);
  assert.match(liveRegion.textContent, /Avbryt återställningen och ladda om sidan/);
  assert.match(liveRegion.textContent, /rensa appdatan och välj backupfilen igen/);
  assert.ok(app.focusedSelectors.includes('[data-action="confirm-restore"]'));
});

test("main clears the file input so the same backup can be chosen twice", async () => {
  const { app, repository } = createTestBrowserApp(cockpitState());

  const first = await chooseRestoreFile(app, restoreFile());
  assert.equal(first.value, "");
  app.dispatch("click", { target: actionTarget("cancel-restore") });

  const second = await chooseRestoreFile(app, restoreFile());
  assert.equal(second.value, "");
  assert.match(app.innerHTML, /Ersätt aktuell data\?/);
  assert.equal(repository.calls.save.length, 0);
});

test("main ignores a change event without a chosen file", async () => {
  const { app, readFileCalls, liveRegion } = createTestBrowserApp();
  liveRegion.textContent = "";

  await chooseRestoreFile(app, null);

  assert.equal(readFileCalls.length, 0);
  assert.equal(liveRegion.textContent, "");
});

test("main demo has no data controls and keeps data workflows blocked", () => {
  const { app, api, downloads } = createTestBrowserApp(null);
  app.dispatch("click", { target: actionTarget("show-demo") });

  assert.match(app.innerHTML, /Syntetiskt demoexempel/);
  assert.doesNotMatch(app.innerHTML, /data-action="download-backup"/);
  assert.doesNotMatch(app.innerHTML, /data-action="download-csv"/);
  assert.doesNotMatch(app.innerHTML, /data-action="choose-restore"/);
  assert.doesNotMatch(app.innerHTML, /data-file-input="restore"/);
  assert.equal(api.controller.createBackupDownload().ok, false);
  assert.equal(api.controller.createCsvDownload().ok, false);
  assert.equal(downloads.length, 0);
});

test("main can be imported without browser globals and renders the loaded cockpit", () => {
  const { app, api } = createTestBrowserApp();

  assert.equal(typeof api.controller.getSnapshot, "function");
  assert.match(app.innerHTML, /Din Sverigeöversikt/);
});

test("main keeps past planned stays planned until explicit outcome confirmation", () => {
  const { app, repository, api } = createTestBrowserApp();

  assert.match(app.innerHTML, /Genomfördes den här planerade vistelsen\?/);
  assert.equal(repository.calls.save.length, 0);
  assert.equal(
    api.controller.getSnapshot().state.stays.find((stay) => stay.id === "planned-august").status,
    "planned"
  );

  app.dispatch("click", {
    target: actionTarget("confirm-actual", { stayId: "planned-august" })
  });
  assert.equal(repository.calls.save.length, 1);
  assert.equal(
    api.controller.getSnapshot().state.stays.find((stay) => stay.id === "planned-august").status,
    "actual"
  );
});

test("main profile editing retains stays", () => {
  const initial = cockpitState();
  const { app, repository } = createTestBrowserApp(initial);
  app.dispatch("click", { target: actionTarget("edit-profile") });
  assert.match(app.innerHTML, /data-form="profile"/);

  withFormData(() => app.dispatch("submit", {
    target: profileForm({
      departureDate: "2025-02-15",
      budgetDays: "7",
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31"
    }),
    preventDefault() {}
  }));

  assert.equal(repository.calls.save.length, 1);
  assert.deepEqual(repository.calls.save[0].stays, initial.stays);
  assert.equal(repository.calls.save[0].profile.budgetDays, 7);
  assert.match(app.innerHTML, /Din Sverigeöversikt/);
});

test("main reopens an invalid stay with field-linked errors", () => {
  const { app, dialog, repository } = createTestBrowserApp();
  app.dispatch("click", { target: actionTarget("add-stay") });
  assert.equal(dialog.open, true);

  const form = stayForm({
    arrivalDate: "2026-08-22",
    departureDate: "2026-08-20",
    status: "planned"
  });
  withFormData(() => dialog.dispatch("submit", {
    target: form,
    preventDefault() {}
  }));

  assert.equal(repository.calls.save.length, 0);
  assert.equal(dialog.open, true);
  assert.match(
    dialog.innerHTML,
    /name="departureDate"[^>]*aria-invalid="true"[^>]*aria-describedby="stay-departureDate-error"/
  );
  assert.match(dialog.innerHTML, /Avresedatum måste vara samma dag eller senare/);
});

test("main update preview excludes the old interval", () => {
  const state = cockpitState({
    profile: { budgetDays: 5 },
    stays: [{
      id: "edit-me",
      arrivalDate: "2026-08-01",
      departureDate: "2026-08-05",
      status: "planned",
      createdAt: "2026-07-31T12:00:00.000Z",
      updatedAt: "2026-07-31T12:00:00.000Z"
    }]
  });
  const { app, dialog } = createTestBrowserApp(state);
  app.dispatch("click", {
    target: actionTarget("edit-stay", { stayId: "edit-me" })
  });

  const form = stayForm({
    arrivalDate: "2026-08-10",
    departureDate: "2026-08-14",
    status: "planned"
  });
  withFormData(() => dialog.dispatch("change", {
    target: { name: "departureDate", closest: () => form }
  }));

  assert.match(dialog.innerHTML, /5 \/ 5 registrerade dagar/);
  assert.doesNotMatch(dialog.innerHTML, /10 \/ 5 registrerade dagar/);
});

test("main requires inline delete confirmation before removing a stay", () => {
  const state = cockpitState({
    stays: [{
      id: "delete-me",
      arrivalDate: "2026-08-01",
      departureDate: "2026-08-05",
      status: "planned",
      createdAt: "2026-07-31T12:00:00.000Z",
      updatedAt: "2026-07-31T12:00:00.000Z"
    }]
  });
  const { app, dialog, repository } = createTestBrowserApp(state);
  app.dispatch("click", {
    target: actionTarget("edit-stay", { stayId: "delete-me" })
  });

  dialog.dispatch("click", { target: actionTarget("request-delete") });
  assert.equal(repository.calls.save.length, 0);
  assert.match(dialog.innerHTML, /data-action="confirm-delete"/);

  dialog.dispatch("click", { target: actionTarget("confirm-delete") });
  assert.equal(repository.calls.save.length, 1);
  assert.deepEqual(repository.calls.save[0].stays, []);
  assert.equal(dialog.open, false);
});

test("main moves focus to a rendered action when persist disconnects the opener", () => {
  const { app, dialog } = createTestBrowserApp();
  const opener = actionTarget("add-stay");
  opener.isConnected = false;
  app.dispatch("click", { target: opener });
  const form = stayForm({
    arrivalDate: "2026-08-20",
    departureDate: "2026-08-22",
    status: "planned"
  });

  withFormData(() => dialog.dispatch("submit", {
    target: form,
    preventDefault() {}
  }));

  assert.equal(dialog.open, false);
  assert.ok(app.focusedSelectors.includes('[data-action="add-stay"]'));
});

test("main closes native dialog cancellation and restores opener focus", () => {
  const { app, dialog } = createTestBrowserApp();
  let focusCount = 0;
  let prevented = 0;
  const opener = actionTarget("add-stay");
  opener.focus = () => { focusCount += 1; };
  app.dispatch("click", { target: opener });

  dialog.dispatch("cancel", {
    preventDefault() {
      prevented += 1;
    }
  });

  assert.equal(prevented, 1);
  assert.equal(dialog.open, false);
  assert.equal(focusCount, 1);
});

test("main clears only after inline confirmation and cancel leaves state untouched", () => {
  const { app, repository, api } = createTestBrowserApp();
  const initial = api.controller.getSnapshot().state;
  app.dispatch("click", { target: actionTarget("request-clear") });
  assert.equal(repository.calls.clear, 0);
  assert.match(app.innerHTML, /profilen och alla registrerade vistelser tas bort/);
  assert.match(app.innerHTML, /data-action="confirm-clear"/);

  app.dispatch("click", { target: actionTarget("cancel-clear") });
  assert.equal(repository.calls.clear, 0);
  assert.equal(api.controller.getSnapshot().state, initial);
  assert.doesNotMatch(app.innerHTML, /data-action="confirm-clear"/);

  app.dispatch("click", { target: actionTarget("request-clear") });
  app.dispatch("click", { target: actionTarget("confirm-clear") });
  assert.equal(repository.calls.clear, 1);
  assert.match(app.innerHTML, /Planera Sverigedagar/);
});

test("main blocks unsupported storage saves and keeps failed clear retry visible", () => {
  const unsupported = {
    code: "unsupported-version",
    message: "Den sparade dataversionen stöds inte. Datan har inte skrivits över."
  };
  const clearFailure = {
    ok: false,
    issue: { code: "clear-failed", message: "All appdata kunde inte rensas." },
    mode: "local"
  };
  const { app, repository } = createTestBrowserApp(null, {
    loadIssue: unsupported,
    clearResult: clearFailure
  });

  assert.match(app.innerHTML, /class="storage-warning" role="alert"/);
  assert.match(app.innerHTML, /data-action="request-clear"/);
  withFormData(() => app.dispatch("submit", {
    target: profileForm({
      departureDate: "2025-02-15",
      budgetDays: "90",
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31"
    }),
    preventDefault() {}
  }));
  assert.equal(repository.calls.save.length, 0);

  app.dispatch("click", { target: actionTarget("request-clear") });
  app.dispatch("click", { target: actionTarget("confirm-clear") });

  assert.equal(repository.calls.clear, 1);
  assert.match(app.innerHTML, /All appdata kunde inte rensas/);
  assert.match(app.innerHTML, /data-action="confirm-clear"/);
  assert.match(app.innerHTML, /data-action="cancel-clear"/);
});

test("main moves roving calendar focus across year boundaries and opens with Enter", () => {
  const { app, dialog } = createTestBrowserApp();
  let prevented = 0;
  const keyEvent = (key, date) => ({
    key,
    target: actionTarget("select-date", { date }),
    preventDefault() {
      prevented += 1;
    }
  });

  app.dispatch("keydown", keyEvent("ArrowRight", "2026-12-31"));
  assert.ok(app.focusedSelectors.includes('[data-date="2027-01-01"]'));
  app.dispatch("keydown", keyEvent("ArrowLeft", "2027-01-01"));
  assert.ok(app.focusedSelectors.includes('[data-date="2026-12-31"]'));
  app.dispatch("keydown", keyEvent("ArrowUp", "2026-08-08"));
  assert.ok(app.focusedSelectors.includes('[data-date="2026-08-01"]'));
  app.dispatch("keydown", keyEvent("ArrowDown", "2026-08-01"));
  assert.ok(app.focusedSelectors.includes('[data-date="2026-08-08"]'));

  app.dispatch("keydown", keyEvent("Enter", "2026-08-20"));
  assert.equal(dialog.open, true);
  assert.match(dialog.innerHTML, /name="arrivalDate"[^>]*value="2026-08-20"/);
  assert.equal(prevented, 5);
});

test("main tolerates denied storage and crypto getters without console fallback", () => {
  assert.equal(typeof createBrowserApp, "function", "createBrowserApp ska exporteras");
  const browser = fakeBrowserDocument();
  const windowRef = {};
  Object.defineProperties(windowRef, {
    localStorage: { get() { throw new Error("denied"); } },
    sessionStorage: { get() { throw new Error("denied"); } },
    crypto: { get() { throw new Error("denied"); } }
  });

  assert.doesNotThrow(() => createBrowserApp({
    documentRef: browser.documentRef,
    windowRef,
    today: "2026-08-16",
    now: () => "2026-08-16T12:00:00.000Z"
  }));
  assert.match(browser.app.innerHTML, /Planera Sverigedagar/);
});
