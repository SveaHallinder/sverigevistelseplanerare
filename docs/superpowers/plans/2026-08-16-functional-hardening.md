# Functional Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock the current source-backed legal behavior, close missing date/state boundaries, and show an exact non-legal explanation of the personal budget calculation.

**Architecture:** Keep existing date, stay, budget and pattern modules authoritative. Add one pure explanation module that composes their outputs, then render it through one small escaped UI module. No derived value is persisted and no legal conclusion is introduced.

**Tech Stack:** Vanilla JavaScript ES modules, Node.js 20+ built-ins, `node:test`, semantic HTML and existing CSS. No dependency.

---

## Preconditions

- Read `CLAUDE.md`, `docs/handoff/CURRENT.md` and the matching design spec first.
- Record a clean baseline with `npm run check`.
- Do not edit `src/domain/patterns.js` unless a new primary-source-backed test actually fails.
- Mark a checkbox only after its command produced the stated result.

### Task 1: Lock official temporary-interruption scenarios

**Files:**
- Create: `test/fixtures/legal-scenarios.js`
- Modify: `test/patterns.test.js`
- Verify: `src/domain/patterns.js`

- [x] **Step 1: Add the fixture import and table-driven test before the fixture exists**

Add this import to `test/patterns.test.js`:

```js
import { TEMPORARY_BREAK_SCENARIOS } from "./fixtures/legal-scenarios.js";
```

Add this test without changing production code:

```js
test("official temporary-break scenarios stay source-backed", async (context) => {
  for (const scenario of TEMPORARY_BREAK_SCENARIOS) {
    await context.test(scenario.name, () => {
      const result = getPossibleTemporaryBreaks(scenario.intervals);
      assert.equal(result.length > 0, scenario.expectedObservation);
      assert.equal(scenario.sourceId, "permanentStay");
      assert.equal(
        scenario.sourceUrl,
        "https://www4.skatteverket.se/rattsligvagledning/edition/2026.7/2637.html"
      );
      assert.equal(scenario.reviewedAt, "2026-08-16");
    });
  }
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test test/patterns.test.js
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `test/fixtures/legal-scenarios.js`.

- [x] **Step 3: Create the frozen source-backed fixtures**

Create `test/fixtures/legal-scenarios.js` with:

```js
const SOURCE_URL =
  "https://www4.skatteverket.se/rattsligvagledning/edition/2026.7/2637.html";

function scenario(name, before, after, expectedObservation) {
  return Object.freeze({
    name,
    sourceId: "permanentStay",
    sourceUrl: SOURCE_URL,
    reviewedAt: "2026-08-16",
    intervals: Object.freeze([
      Object.freeze(before),
      Object.freeze(after)
    ]),
    expectedObservation
  });
}

export const TEMPORARY_BREAK_SCENARIOS = Object.freeze([
  scenario(
    "gap shorter than both neighbouring stays",
    { arrivalDate: "2026-01-01", departureDate: "2026-03-31" },
    { arrivalDate: "2026-06-01", departureDate: "2026-08-31" },
    true
  ),
  scenario(
    "gap longer than the previous but shorter than the following stay",
    { arrivalDate: "2026-01-01", departureDate: "2026-02-28" },
    { arrivalDate: "2026-06-01", departureDate: "2026-09-30" },
    true
  ),
  scenario(
    "gap longer than both neighbouring stays",
    { arrivalDate: "2026-01-01", departureDate: "2026-02-28" },
    { arrivalDate: "2026-06-01", departureDate: "2026-07-31" },
    false
  ),
  scenario(
    "gap reaching the six-month boundary",
    { arrivalDate: "2025-01-01", departureDate: "2025-12-31" },
    { arrivalDate: "2026-07-02", departureDate: "2027-06-30" },
    false
  )
]);
```

The asymmetric second fixture is the mutation-sensitive proof that the current `||` condition is intentional.

- [x] **Step 4: Run legal pattern and observation tests and verify GREEN**

Run:

```bash
node --test test/patterns.test.js test/observations.test.js
```

Expected: PASS. If it fails, inspect the official source URL stored in the fixture before touching production code. Do not change `||` to `&&`.

- [x] **Step 5: Commit the source-backed fixtures**

Run:

```bash
git diff --check
git add test/fixtures/legal-scenarios.js test/patterns.test.js docs/superpowers/plans/2026-08-16-functional-hardening.md
git commit -m "test: lock source-backed legal scenarios"
```

### Task 2: Close state and budget boundary gaps

**Files:**
- Modify: `test/validation.test.js`
- Modify: `src/domain/validation.js`
- Modify: `test/budget.test.js`
- Verify: `src/domain/budget.js`

- [x] **Step 1: Add the hidden-stay invariant test**

Add to `test/validation.test.js` using its existing valid stay fixture shape:

```js
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
```

- [x] **Step 2: Run the invariant test and verify RED**

Run:

```bash
node --test --test-name-pattern="without a profile" test/validation.test.js
```

Expected: FAIL because current validation accepts the state.

- [x] **Step 3: Add the minimal AppState invariant**

In `validateAppState`, immediately after the root shape guard and before profile normalization, add:

```js
if (input.profile === null && input.stays.length > 0) {
  return failed({}, "Sparad data utan profil får inte innehålla vistelser.");
}
```

- [x] **Step 4: Add missing calculation characterization tests**

Append to `test/budget.test.js`:

```js
test("evaluatePlannedStay reports no candidate boundary outside the period", () => {
  const result = evaluatePlannedStay(
    profile({ periodStart: "2026-08-01", periodEnd: "2026-08-31" }),
    [],
    {
      arrivalDate: "2026-09-01",
      departureDate: "2026-09-03",
      status: "planned"
    }
  );

  assert.equal(result.uniqueDays, 0);
  assert.equal(result.excludedDays, 3);
  assert.equal(result.candidateLastWithinBudgetDate, null);
  assert.equal(result.candidateFirstExceededDate, null);
});

test("budget ranks non-contiguous registered dates chronologically", () => {
  const result = calculateBudget(profile({ budgetDays: 2 }), [
    {
      arrivalDate: "2026-08-10",
      departureDate: "2026-08-10",
      status: "planned"
    },
    {
      arrivalDate: "2026-08-01",
      departureDate: "2026-08-01",
      status: "actual"
    },
    {
      arrivalDate: "2026-08-20",
      departureDate: "2026-08-20",
      status: "planned"
    }
  ]);

  assert.deepEqual(result.registeredDates, [
    "2026-08-01",
    "2026-08-10",
    "2026-08-20"
  ]);
  assert.equal(result.lastWithinBudgetDate, "2026-08-10");
  assert.equal(result.firstExceededDate, "2026-08-20");
});
```

- [x] **Step 5: Run the focused boundary suite and verify GREEN**

Run:

```bash
node --test test/validation.test.js test/dates.test.js test/stays.test.js test/budget.test.js
```

Expected: PASS. The new budget cases should characterize existing code; only the state invariant should require production change.

- [x] **Step 6: Commit the invariant and boundary coverage**

Run:

```bash
git diff --check
git add src/domain/validation.js test/validation.test.js test/budget.test.js docs/superpowers/plans/2026-08-16-functional-hardening.md
git commit -m "fix: reject hidden stays without a profile"
```

### Task 3: Build the pure calculation explanation

**Files:**
- Create: `src/domain/budget-explanation.js`
- Create: `test/budget-explanation.test.js`

- [ ] **Step 1: Write the explanation contract test before the module exists**

Create `test/budget-explanation.test.js` with:

```js
import assert from "node:assert/strict";
import test from "node:test";

const explanationModule = await import(
  "../src/domain/budget-explanation.js"
).catch(() => ({}));
const { buildBudgetExplanation } = explanationModule;

const profile = {
  budgetDays: 5,
  periodStart: "2026-08-01",
  periodEnd: "2026-08-31"
};

test("buildBudgetExplanation composes existing budget and pattern facts", () => {
  assert.equal(typeof buildBudgetExplanation, "function");
  const stays = [
    {
      arrivalDate: "2026-07-31",
      departureDate: "2026-08-02",
      status: "actual"
    },
    {
      arrivalDate: "2026-08-02",
      departureDate: "2026-08-06",
      status: "planned"
    }
  ];
  const before = structuredClone(stays);

  const result = buildBudgetExplanation(profile, stays);

  assert.deepEqual(result.period, {
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    budgetDays: 5
  });
  assert.deepEqual(result.totals, {
    actualDays: 2,
    plannedDays: 5,
    uniqueDays: 6,
    overlapDays: 1,
    excludedDays: 1,
    remaining: -1,
    overBy: 1
  });
  assert.deepEqual(result.boundary, {
    lastWithinBudgetDate: "2026-08-05",
    firstExceededDate: "2026-08-06"
  });
  assert.deepEqual(result.includedRanges, [
    { startDate: "2026-08-01", endDate: "2026-08-02", status: "actual" },
    { startDate: "2026-08-03", endDate: "2026-08-06", status: "planned" }
  ]);
  assert.deepEqual(result.excludedRanges, [
    { startDate: "2026-07-31", endDate: "2026-07-31", status: "actual" }
  ]);
  assert.deepEqual(result.overlapRanges, [
    { startDate: "2026-08-02", endDate: "2026-08-02", status: "overlap" }
  ]);
  assert.equal(result.actualPattern.visitCount, 1);
  assert.equal(result.actualPattern.totalDays, 3);
  assert.equal(result.scenarioPattern.visitCount, 1);
  assert.equal(result.scenarioPattern.totalDays, 7);
  assert.equal(result.hasPlannedStays, true);
  assert.deepEqual(stays, before);
});

test("buildBudgetExplanation has stable empty ranges", () => {
  const result = buildBudgetExplanation(profile, []);

  assert.deepEqual(result.includedRanges, []);
  assert.deepEqual(result.excludedRanges, []);
  assert.deepEqual(result.overlapRanges, []);
  assert.equal(result.actualPattern.visitCount, 0);
  assert.equal(result.scenarioPattern.longestStayDays, 0);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test test/budget-explanation.test.js
```

Expected: FAIL because `buildBudgetExplanation` is missing.

- [ ] **Step 3: Implement the pure composition module**

Create `src/domain/budget-explanation.js` with:

```js
import { calculateBudget } from "./budget.js";
import { addDays } from "./dates.js";
import { calculatePatternFacts } from "./patterns.js";
import { getStayDaySets } from "./stays.js";

function rangesFor(dates, statusForDate) {
  const ranges = [];
  for (const date of [...dates].sort()) {
    const status = statusForDate(date);
    const current = ranges.at(-1);
    if (
      current
      && current.status === status
      && date === addDays(current.endDate, 1)
    ) {
      current.endDate = date;
    } else {
      ranges.push({ startDate: date, endDate: date, status });
    }
  }
  return ranges;
}

function summarizePattern(facts) {
  return {
    visitCount: facts.visitCount,
    totalDays: facts.totalDays,
    longestStayDays: facts.longestStayDays,
    gapLengths: [...facts.gapLengths]
  };
}

export function buildBudgetExplanation(profile, stays) {
  const budget = calculateBudget(profile, stays);
  const sets = getStayDaySets(stays);
  const overlapDates = [...sets.actualDates].filter((date) =>
    sets.plannedDates.has(date)
    && date >= profile.periodStart
    && date <= profile.periodEnd);
  const actualStays = stays.filter((stay) => stay.status === "actual");

  return {
    period: {
      startDate: profile.periodStart,
      endDate: profile.periodEnd,
      budgetDays: profile.budgetDays
    },
    totals: {
      actualDays: budget.actualDays,
      plannedDays: budget.plannedDays,
      uniqueDays: budget.uniqueDays,
      overlapDays: overlapDates.length,
      excludedDays: budget.excludedDays,
      remaining: budget.remaining,
      overBy: budget.overBy
    },
    boundary: {
      lastWithinBudgetDate: budget.lastWithinBudgetDate,
      firstExceededDate: budget.firstExceededDate
    },
    includedRanges: rangesFor(
      budget.registeredDates,
      (date) => budget.statusByDate[date]
    ),
    excludedRanges: rangesFor(
      budget.excludedDates,
      (date) => budget.statusByDate[date]
    ),
    overlapRanges: rangesFor(overlapDates, () => "overlap"),
    actualPattern: summarizePattern(calculatePatternFacts(actualStays)),
    scenarioPattern: summarizePattern(calculatePatternFacts(stays)),
    hasPlannedStays: stays.some((stay) => stay.status === "planned"),
    rules: {
      inclusiveEndpoints: true,
      uniqueBudgetDates: true,
      actualPresentationPrecedence: true
    }
  };
}
```

- [ ] **Step 4: Run explanation and dependency tests and verify GREEN**

Run:

```bash
node --test test/budget-explanation.test.js test/budget.test.js test/patterns.test.js
```

Expected: PASS with no mutation of inputs.

- [ ] **Step 5: Commit the pure explanation model**

Run:

```bash
git diff --check
git add src/domain/budget-explanation.js test/budget-explanation.test.js docs/superpowers/plans/2026-08-16-functional-hardening.md
git commit -m "feat: explain personal budget calculations"
```

### Task 4: Render exact boundaries and calculation facts

**Files:**
- Create: `src/ui/budget-explanation.js`
- Modify: `src/ui/cockpit.js`
- Modify: `styles.css`
- Modify: `test/ui.test.js`

- [ ] **Step 1: Add failing model and markup assertions**

In `test/ui.test.js`, extend the cockpit model test to assert:

```js
assert.equal(model.explanation.totals.overlapDays, 1);
assert.equal(model.explanation.boundary.firstExceededDate, "2026-08-06");
```

Add a rendering test using the existing cockpit fixture:

```js
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
```

- [ ] **Step 2: Run the focused UI tests and verify RED**

Run:

```bash
node --test --test-name-pattern="explains registered-day|overlap-aware KPIs" test/ui.test.js
```

Expected: FAIL because `explanation` and the disclosure do not exist.

- [ ] **Step 3: Create the escaped explanation renderer**

Create `src/ui/budget-explanation.js` with this complete implementation:

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

function formatDate(value) {
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "long",
    timeZone: "UTC"
  }).format(new Date(value + "T00:00:00Z"));
}

function statusLabel(status) {
  return {
    actual: "Faktisk",
    planned: "Planerad",
    overlap: "Faktisk och planerad"
  }[status] ?? "Registrerad";
}

function renderRange(range) {
  const dates = range.startDate === range.endDate
    ? formatDate(range.startDate)
    : formatDate(range.startDate) + "–" + formatDate(range.endDate);
  return "<li><strong>" + escapeHtml(statusLabel(range.status))
    + ":</strong> " + escapeHtml(dates) + "</li>";
}

function renderRanges(title, ranges, emptyText) {
  return "<section><h3>" + escapeHtml(title) + "</h3>"
    + (ranges.length === 0
      ? "<p>" + escapeHtml(emptyText) + "</p>"
      : "<ul>" + ranges.map(renderRange).join("") + "</ul>")
    + "</section>";
}

function renderPattern(label, facts) {
  const visits = facts.visitCount === 1
    ? "1 sammanslaget besök"
    : facts.visitCount + " sammanslagna besök";
  const gaps = facts.gapLengths.length === 0
    ? "Inga oregistrerade mellanrum mellan sammanslagna besök."
    : "Oregistrerade dagar mellan sammanslagna besök: "
      + facts.gapLengths.join(", ") + ".";
  return "<p><strong>" + escapeHtml(label) + ":</strong> "
    + escapeHtml(visits) + ", " + escapeHtml(facts.totalDays)
    + " registrerade dagar, längsta sammanhängande registrering "
    + escapeHtml(facts.longestStayDays) + " dagar. "
    + escapeHtml(gaps) + "</p>";
}

export function renderBudgetExplanation(model) {
  const formula = model.period.budgetDays + " − "
    + model.totals.uniqueDays + " = " + model.totals.remaining;
  const balance = model.totals.overBy > 0
    ? model.totals.overBy + " dagar över den personliga budgeten."
    : model.totals.remaining + " dagar kvar i den personliga budgeten.";
  const scenario = model.hasPlannedStays
    ? renderPattern("Faktisk plus planerad", model.scenarioPattern)
    : "";

  return '<details class="calculation-details"><summary>Så räknas planen</summary>'
    + '<div class="calculation-details__body">'
    + "<p>Detta förklarar din personliga budget, inte en juridisk gräns.</p>"
    + "<p>Ankomst- och avresedag räknas; överlappande datum räknas en gång "
    + "i budgeten och faktisk status visas först.</p>"
    + '<dl><div><dt>Faktiska dagar</dt><dd>'
    + escapeHtml(model.totals.actualDays) + "</dd></div>"
    + "<div><dt>Planerade dagar</dt><dd>"
    + escapeHtml(model.totals.plannedDays) + "</dd></div>"
    + "<div><dt>Unika dagar</dt><dd>"
    + escapeHtml(model.totals.uniqueDays) + "</dd></div>"
    + "<div><dt>Överlappande dagar</dt><dd>"
    + escapeHtml(model.totals.overlapDays) + "</dd></div></dl>"
    + "<p><strong>Budgetformel:</strong> " + escapeHtml(formula)
    + ". " + escapeHtml(balance) + "</p>"
    + renderRanges(
      "Registrerade intervall i budgetperioden",
      model.includedRanges,
      "Inga registrerade intervall i budgetperioden."
    )
    + renderRanges(
      "Intervall utanför budgetperioden",
      model.excludedRanges,
      "Inga registrerade intervall ligger utanför budgetperioden."
    )
    + renderRanges(
      "Överlapp mellan faktisk och planerad status",
      model.overlapRanges,
      "Inga faktiska och planerade datum överlappar."
    )
    + "<section><h3>Registrerat mönster</h3>"
    + renderPattern("Faktisk historik", model.actualPattern)
    + scenario + "</section></div></details>";
}
```

The module exports only `renderBudgetExplanation`. Empty arrays produce neutral copy, one-day ranges print one date, longer ranges print both endpoints, and the combined scenario paragraph renders only when planned stays exist.

- [ ] **Step 4: Compose the explanation in the cockpit**

In `src/ui/cockpit.js`:

```js
import { buildBudgetExplanation } from "../domain/budget-explanation.js";
import { renderBudgetExplanation } from "./budget-explanation.js";
```

Add to the object returned by `buildCockpitModel`:

```js
explanation: buildBudgetExplanation(state.profile, state.stays),
```

In `renderBudgetStatus`, append this sentence when `firstExceededDate` exists:

```js
"<p>Första registrerade dag över budget: "
  + escapeHtml(formatDate(model.budget.firstExceededDate)) + "</p>"
```

Render `renderBudgetExplanation(model.explanation)` directly after the current budget-status section and before the legend. Do not move or redesign existing cockpit sections.

- [ ] **Step 5: Add only the accessibility CSS needed by the native disclosure**

Append to the relevant cockpit section in `styles.css`:

```css
.calculation-details {
  margin-top: 1rem;
  border: 1px solid var(--border);
  border-radius: 1rem;
  background: var(--surface);
}

.calculation-details summary {
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  cursor: pointer;
  font-weight: 700;
}

.calculation-details__body {
  padding: 0 1rem 1rem;
}
```

If token names differ, reuse the existing surface/border tokens from the top of `styles.css`; do not introduce a parallel palette.

- [ ] **Step 6: Run focused and full UI tests and verify GREEN**

Run:

```bash
node --test test/budget-explanation.test.js test/budget.test.js test/ui.test.js
```

Expected: PASS. Also run:

```bash
npm run lint
git diff --check
```

Expected: both exit 0.

- [ ] **Step 7: Commit the functional disclosure**

Run:

```bash
git add src/ui/budget-explanation.js src/ui/cockpit.js styles.css test/ui.test.js docs/superpowers/plans/2026-08-16-functional-hardening.md
git commit -m "feat: show how registered days are calculated"
```

### Task 5: Update QA and close phase 1

**Files:**
- Modify: `docs/qa/localhost.md`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-08-16-functional-hardening.md`

- [ ] **Step 1: Extend existing QA step 3 without exceeding seven total steps**

Update step 3 in `docs/qa/localhost.md` to require:

```text
Öppna "Så räknas planen". Verifiera inkluderande ankomst/avresa, en överlappande dag, inkluderade/exkluderade intervall, faktisk/scenario-mönsterfakta, "Senaste registrerade dag inom budget: 5 augusti 2026" och "Första registrerade dag över budget: 6 augusti 2026". Ingen text får kalla datumen juridiskt säkra eller säga att användaren måste lämna Sverige.
```

- [ ] **Step 2: Add the shipped explanation to README only after it exists**

Under `Data och MVP-gräns`, add one factual sentence:

```text
Cockpiten visar hur registrerade dagar, överlapp, exkluderade datum och personliga budgetgränser har räknats.
```

- [ ] **Step 3: Run the complete serial verification**

Run:

```bash
npm run check
git diff --check
git status --short
```

Expected: lint, all tests and build pass; diff check exits 0; status contains only the intended phase-1 docs before commit.

- [ ] **Step 4: Run localhost regression QA**

Run `npm run dev`, execute all steps in `docs/qa/localhost.md`, and record the exact result in the commit handoff. Verify no console errors and no failed requests.

- [ ] **Step 5: Commit phase-1 docs and checked plan**

Run:

```bash
git add README.md docs/qa/localhost.md docs/superpowers/plans/2026-08-16-functional-hardening.md
git commit -m "docs: verify functional calculation hardening"
```

## Phase 1 completion gate

Before starting the portability plan:

```bash
npm run check
git status --short
git log --oneline -5
```

Expected: full check exits 0, worktree is clean, and Tasks 1–5 are separate local commits. Continue directly with `docs/superpowers/plans/2026-08-16-local-data-portability.md`.
