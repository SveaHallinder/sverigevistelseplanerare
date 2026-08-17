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

test("buildBudgetExplanation exposes no unrendered fields", () => {
  const result = buildBudgetExplanation(profile, []);

  assert.deepEqual(Object.keys(result).sort(), [
    "actualPattern",
    "boundary",
    "excludedRanges",
    "hasPlannedStays",
    "includedRanges",
    "overlapRanges",
    "period",
    "scenarioPattern",
    "totals"
  ]);
});

test("buildBudgetExplanation has stable empty ranges", () => {
  const result = buildBudgetExplanation(profile, []);

  assert.deepEqual(result.includedRanges, []);
  assert.deepEqual(result.excludedRanges, []);
  assert.deepEqual(result.overlapRanges, []);
  assert.equal(result.actualPattern.visitCount, 0);
  assert.equal(result.scenarioPattern.longestStayDays, 0);
});
