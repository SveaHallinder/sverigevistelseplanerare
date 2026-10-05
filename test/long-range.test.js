import assert from "node:assert/strict";
import test from "node:test";
import { calculateBudget, evaluatePlannedStay } from "../src/domain/budget.js";
import { buildBudgetExplanation } from "../src/domain/budget-explanation.js";
import { maxRollingTwelveMonthDays } from "../src/domain/patterns.js";
import { validateAppState, validateProfile } from "../src/domain/validation.js";
import { buildCockpitModel, renderCockpit } from "../src/ui/cockpit.js";

const profile = validateProfile({
  departureDate: "2025-01-01",
  periodStart: "2026-01-01",
  periodEnd: "2026-12-31",
  budgetDays: 90,
  connectionChecklist: { workDuringStays: "yes" }
}).value;
const longStay = {
  id: "long",
  arrivalDate: "0100-01-01",
  departureDate: "9999-12-31",
  status: "actual",
  createdAt: "2026-10-05T10:00:00.000Z",
  updatedAt: "2026-10-05T10:00:00.000Z"
};

function guardDailyExpansion(context) {
  const from = Array.from;
  context.mock.method(Array, "from", (items, ...args) => {
    assert.ok(
      typeof items?.length !== "number" || items.length <= 366,
      "[long-range] UI får inte allokera en daglig array över 366 datum."
    );
    return from.call(Array, items, ...args);
  });
  const utc = Date.UTC;
  let calendarCalls = 0;
  context.mock.method(Date, "UTC", (...args) => {
    calendarCalls += 1;
    assert.ok(calendarCalls <= 200_000, "[long-range] Kalenderarbetet får inte följa miljontals dagar.");
    return utc(...args);
  });
}

test("compact budget counts the entire accepted date range without daily expansion", (context) => {
  guardDailyExpansion(context);
  const state = { version: 1, profile, stays: [longStay] };
  assert.equal(validateAppState(state).ok, true);

  const budget = calculateBudget(profile, state.stays, { expandDates: false });

  assert.equal(budget.actualDays, 365);
  assert.equal(budget.plannedDays, 0);
  assert.equal(budget.uniqueDays, 365);
  assert.equal(budget.excludedDays, 3_615_535);
  assert.equal(budget.remaining, -275);
  assert.equal(budget.lastWithinBudgetDate, "2026-03-31");
  assert.equal(budget.firstExceededDate, "2026-04-01");
  assert.equal(Object.hasOwn(budget, "registeredDates"), false);
  assert.equal(Object.hasOwn(budget, "excludedDates"), false);
  assert.deepEqual(budget.registeredRanges, [
    { startDate: "2026-01-01", endDate: "2026-12-31", status: "actual" }
  ]);
  assert.deepEqual(budget.excludedRanges, [
    { startDate: "0100-01-01", endDate: "2025-12-31", status: "actual" },
    { startDate: "2027-01-01", endDate: "9999-12-31", status: "actual" }
  ]);
});

test("compact preview ranks a full-range candidate and overlap without daily expansion", (context) => {
  guardDailyExpansion(context);
  const preview = evaluatePlannedStay(profile, [], longStay, { expandDates: false });

  assert.equal(preview.candidateDays, 3_615_900);
  assert.equal(preview.candidateDaysInPeriod, 365);
  assert.equal(preview.candidateDaysOutsidePeriod, 3_615_535);
  assert.equal(preview.candidateNewDays, 365);
  assert.equal(preview.candidateOverlapDays, 0);
  assert.equal(preview.candidateLastWithinBudgetDate, "2026-03-31");
  assert.equal(preview.candidateFirstExceededDate, "2026-04-01");
  const overlapping = evaluatePlannedStay(profile, [longStay], longStay, { expandDates: false });
  assert.equal(overlapping.candidateNewDays, 0);
  assert.equal(overlapping.candidateOverlapDays, 365);
  const edited = evaluatePlannedStay(profile, [longStay], longStay, {
    excludeStayId: "long", expandDates: false
  });
  assert.equal(edited.candidateNewDays, 365);
});

test("rolling windows preserve the earliest leap-length maximum across millennia", (context) => {
  guardDailyExpansion(context);
  assert.deepEqual(maxRollingTwelveMonthDays([longStay]), {
    count: 366,
    windowStart: "0103-03-01",
    windowEnd: "0104-02-29"
  });
});

test("cockpit renders only the viewed year while keeping complete history and excluded ranges", (context) => {
  guardDailyExpansion(context);
  const state = { version: 1, profile, stays: [longStay] };
  const model = buildCockpitModel(state, { today: "2026-10-05", year: 2024, calendarView: "year" });

  assert.equal(model.budget.uniqueDays, 365);
  assert.equal(Object.keys(model.statusByDate).length, 366);
  assert.equal(model.statusByDate["2024-02-29"], "actual");
  assert.equal(model.statusByDate["2026-01-01"], undefined);
  assert.equal(model.explanation.actualPattern.totalDays, 3_615_900);
  assert.equal(model.explanation.actualPattern.longestStayDays, 3_615_900);
  assert.deepEqual(model.explanation.excludedRanges, model.budget.excludedRanges);
  const rolling = model.observations.find((row) => row.id === "work-rolling-window");
  assert.equal(rolling.evidence.every((line) => line.includes("366")), true);
  const html = renderCockpit(model);
  assert.match(html, /3615535 registrerade dagar ligger utanför budgetperioden/);
  assert.match(html, /29 februari 2024, faktisk vistelse/);
});

test("compact calculations preserve default results for seeded overlapping and clipped scenarios", () => {
  const dayMs = 86_400_000;
  const epoch = (date) => Date.parse(date + "T00:00:00Z") / dayMs;
  const iso = (day) => new Date(day * dayMs).toISOString().split("T")[0];
  let seed = 0x347eb40;
  const next = (maximum) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % maximum;
  };
  const fields = [
    "actualDays", "plannedDays", "uniqueDays", "excludedDays", "remaining", "overBy",
    "lastWithinBudgetDate", "firstExceededDate", "candidateDays", "candidateDaysInPeriod",
    "candidateNewDays", "candidateOverlapDays", "candidateDaysOutsidePeriod",
    "candidateLastWithinBudgetDate", "candidateFirstExceededDate"
  ];
  function referenceRanges(dates, statusForDate) {
    const ranges = [];
    for (const date of dates) {
      const status = statusForDate(date);
      const current = ranges.at(-1);
      if (current && current.status === status && epoch(date) - epoch(current.endDate) === 1) {
        current.endDate = date;
      } else {
        ranges.push({ startDate: date, endDate: date, status });
      }
    }
    return ranges;
  }
  for (const [origin, horizon] of [["0100-01-01", 800], ["2023-01-01", 800], ["9998-01-01", 730]]) {
    for (let scenario = 0; scenario < 100; scenario += 1) {
      const firstDay = epoch(origin);
      const lastDay = firstDay + horizon - 1;
      const stays = Array.from({ length: next(10) }, (_, index) => {
        const start = firstDay + next(horizon);
        return {
          id: "stay-" + index,
          arrivalDate: iso(start),
          departureDate: iso(start + next(Math.min(40, lastDay - start + 1))),
          status: next(2) ? "actual" : "planned"
        };
      });
      const start = firstDay + next(horizon);
      const periodStart = firstDay + next(horizon);
      const periodEnd = periodStart + next(lastDay - periodStart + 1);
      const localProfile = {
        periodStart: iso(periodStart), periodEnd: iso(periodEnd),
        budgetDays: 1 + next(periodEnd - periodStart + 1)
      };
      const candidate = {
        arrivalDate: iso(start),
        departureDate: iso(start + next(Math.min(40, lastDay - start + 1))),
        status: "planned"
      };
      const excludeStayId = stays.length && next(2) ? stays[next(stays.length)].id : null;
      const expanded = evaluatePlannedStay(localProfile, stays, candidate, { excludeStayId });
      const compact = evaluatePlannedStay(localProfile, stays, candidate, { excludeStayId, expandDates: false });
      for (const field of fields) assert.equal(compact[field], expanded[field], field + ": " + origin);
      assert.equal(Array.isArray(expanded.registeredDates), true);
      assert.equal(Object.hasOwn(compact, "registeredDates"), false);
      const expandedBudget = calculateBudget(localProfile, stays);
      const compactBudget = calculateBudget(localProfile, stays, { expandDates: false });
      const statusForDate = (date) => expandedBudget.statusByDate[date];
      const overlaps = expandedBudget.registeredDates.filter((date) =>
        stays.some((stay) => stay.status === "actual" && stay.arrivalDate <= date && stay.departureDate >= date)
        && stays.some((stay) => stay.status === "planned" && stay.arrivalDate <= date && stay.departureDate >= date));
      const includedRanges = referenceRanges(expandedBudget.registeredDates, statusForDate);
      const excludedRanges = referenceRanges(expandedBudget.excludedDates, statusForDate);
      const overlapRanges = referenceRanges(overlaps, () => "overlap");
      assert.deepEqual(compactBudget.registeredRanges, includedRanges);
      assert.deepEqual(compactBudget.excludedRanges, excludedRanges);
      assert.deepEqual(compactBudget.overlapRanges, overlapRanges);
      const explanation = buildBudgetExplanation(localProfile, stays);
      assert.deepEqual(explanation.includedRanges, includedRanges);
      assert.deepEqual(explanation.excludedRanges, excludedRanges);
      assert.deepEqual(explanation.overlapRanges, overlapRanges);
    }
  }
});
