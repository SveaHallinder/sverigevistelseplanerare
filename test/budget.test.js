import assert from "node:assert/strict";
import test from "node:test";
import * as budgetApi from "../src/domain/budget.js";

const { calculateBudget, evaluatePlannedStay } = budgetApi;

function profile(overrides = {}) {
  return {
    budgetDays: 5,
    periodStart: "2026-08-01",
    periodEnd: "2026-08-31",
    ...overrides
  };
}

test("budget exports only the documented API", () => {
  assert.deepEqual(Object.keys(budgetApi).sort(), [
    "calculateBudget",
    "evaluatePlannedStay"
  ]);
});

test("calculateBudget reports overlapping actual and planned days", () => {
  const stays = [
    {
      arrivalDate: "2026-08-01",
      departureDate: "2026-08-02",
      status: "actual"
    },
    {
      arrivalDate: "2026-08-02",
      departureDate: "2026-08-06",
      status: "planned"
    }
  ];

  const result = calculateBudget(profile(), stays);

  assert.equal(result.actualDays, 2);
  assert.equal(result.plannedDays, 5);
  assert.equal(result.uniqueDays, 6);
  assert.equal(result.remaining, -1);
  assert.equal(result.overBy, 1);
  assert.equal(result.lastWithinBudgetDate, "2026-08-05");
  assert.equal(result.firstExceededDate, "2026-08-06");
  assert.deepEqual(result.registeredDates, [
    "2026-08-01",
    "2026-08-02",
    "2026-08-03",
    "2026-08-04",
    "2026-08-05",
    "2026-08-06"
  ]);
  assert.equal(result.statusByDate["2026-08-02"], "actual");
});

test("calculateBudget leaves both boundary dates null below budget", () => {
  const result = calculateBudget(profile(), [{
    arrivalDate: "2026-08-01",
    departureDate: "2026-08-04",
    status: "actual"
  }]);

  assert.equal(result.uniqueDays, 4);
  assert.equal(result.remaining, 1);
  assert.equal(result.overBy, 0);
  assert.equal(result.lastWithinBudgetDate, null);
  assert.equal(result.firstExceededDate, null);
});

test("calculateBudget identifies the last date when budget is reached exactly", () => {
  const result = calculateBudget(profile(), [{
    arrivalDate: "2026-08-01",
    departureDate: "2026-08-05",
    status: "planned"
  }]);

  assert.equal(result.uniqueDays, 5);
  assert.equal(result.remaining, 0);
  assert.equal(result.overBy, 0);
  assert.equal(result.lastWithinBudgetDate, "2026-08-05");
  assert.equal(result.firstExceededDate, null);
});

test("evaluatePlannedStay marks the first new date when budget is already full", () => {
  const stays = [{
    arrivalDate: "2026-08-01",
    departureDate: "2026-08-02",
    status: "actual"
  }];
  const candidate = {
    arrivalDate: "2026-08-03",
    departureDate: "2026-08-04",
    status: "planned"
  };

  const result = evaluatePlannedStay(profile({ budgetDays: 2 }), stays, candidate);

  assert.equal(result.lastWithinBudgetDate, "2026-08-02");
  assert.equal(result.firstExceededDate, "2026-08-03");
  assert.equal(result.candidateLastWithinBudgetDate, null);
  assert.equal(result.candidateFirstExceededDate, "2026-08-03");
});

test("evaluatePlannedStay excludes the edited stay and forces candidate to planned", () => {
  const stays = [{
    id: "edited",
    arrivalDate: "2026-08-01",
    departureDate: "2026-08-02",
    status: "planned"
  }];
  const candidate = {
    id: "edited",
    arrivalDate: "2026-08-10",
    departureDate: "2026-08-11",
    status: "actual"
  };
  const staysBefore = structuredClone(stays);
  const candidateBefore = structuredClone(candidate);

  const result = evaluatePlannedStay(
    profile({ budgetDays: 2 }),
    stays,
    candidate,
    { excludeStayId: "edited" }
  );

  assert.equal(result.actualDays, 0);
  assert.equal(result.plannedDays, 2);
  assert.equal(result.uniqueDays, 2);
  assert.equal(result.lastWithinBudgetDate, "2026-08-11");
  assert.equal(result.firstExceededDate, null);
  assert.equal(result.candidateLastWithinBudgetDate, "2026-08-11");
  assert.equal(result.candidateFirstExceededDate, null);
  assert.equal(result.statusByDate["2026-08-10"], "planned");
  assert.equal(result.candidateDays, 2);
  assert.equal(result.candidateNewDays, 2);
  assert.equal(result.candidateOverlapDays, 0);
  assert.deepEqual(stays, staysBefore);
  assert.deepEqual(candidate, candidateBefore);
});

test("calculateBudget excludes dates outside the budget period", () => {
  const result = calculateBudget(profile({ budgetDays: 3 }), [{
    arrivalDate: "2026-07-30",
    departureDate: "2026-08-02",
    status: "actual"
  }]);

  assert.equal(result.actualDays, 2);
  assert.equal(result.uniqueDays, 2);
  assert.equal(result.remaining, 1);
  assert.equal(result.overBy, 0);
  assert.equal(result.excludedDays, 2);
  assert.deepEqual(result.excludedDates, ["2026-07-30", "2026-07-31"]);
  assert.deepEqual(result.registeredDates, ["2026-08-01", "2026-08-02"]);
});

test("evaluatePlannedStay ranks overlapping candidate dates after period clipping", () => {
  const stays = [{
    arrivalDate: "2026-08-02",
    departureDate: "2026-08-03",
    status: "actual"
  }];
  const candidate = {
    arrivalDate: "2026-07-31",
    departureDate: "2026-08-06",
    status: "planned"
  };

  const result = evaluatePlannedStay(profile({
    budgetDays: 4,
    periodStart: "2026-08-02",
    periodEnd: "2026-08-06"
  }), stays, candidate);

  assert.equal(result.actualDays, 2);
  assert.equal(result.plannedDays, 5);
  assert.equal(result.uniqueDays, 5);
  assert.equal(result.excludedDays, 2);
  assert.equal(result.candidateLastWithinBudgetDate, "2026-08-05");
  assert.equal(result.candidateFirstExceededDate, "2026-08-06");
  assert.equal(result.statusByDate["2026-08-02"], "actual");
  assert.equal(result.candidateDays, 7);
  assert.equal(result.candidateDaysInPeriod, 5);
  assert.equal(result.candidateNewDays, 3);
  assert.equal(result.candidateOverlapDays, 2);
  assert.equal(result.candidateDaysOutsidePeriod, 2);
});

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
  assert.equal(result.candidateDays, 3);
  assert.equal(result.candidateDaysInPeriod, 0);
  assert.equal(result.candidateNewDays, 0);
  assert.equal(result.candidateOverlapDays, 0);
  assert.equal(result.candidateDaysOutsidePeriod, 3);
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
