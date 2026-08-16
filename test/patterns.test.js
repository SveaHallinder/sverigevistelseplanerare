import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePatternFacts,
  getPossibleTemporaryBreaks,
  getSixMonthStays,
  maxRollingTwelveMonthDays
} from "../src/domain/patterns.js";

test("getSixMonthStays requires the interval to reach its six-month date", () => {
  assert.deepEqual(getSixMonthStays([{
    arrivalDate: "2026-01-01",
    departureDate: "2026-06-30"
  }]), []);

  assert.deepEqual(getSixMonthStays([{
    arrivalDate: "2026-01-01",
    departureDate: "2026-07-01"
  }]), [{
    arrivalDate: "2026-01-01",
    departureDate: "2026-07-01",
    sixMonthDate: "2026-07-01"
  }]);
});

test("getPossibleTemporaryBreaks reports a gap no longer than either stay", () => {
  const intervals = [
    { arrivalDate: "2026-01-01", departureDate: "2026-01-10" },
    { arrivalDate: "2026-01-16", departureDate: "2026-01-25" }
  ];
  const before = structuredClone(intervals);

  assert.deepEqual(getPossibleTemporaryBreaks(intervals), [{
    before: intervals[0],
    after: intervals[1],
    gapStart: "2026-01-11",
    gapEnd: "2026-01-15",
    gapDays: 5,
    beforeDays: 10,
    afterDays: 10
  }]);
  assert.deepEqual(intervals, before);
});

test("getPossibleTemporaryBreaks excludes a gap longer than either stay", () => {
  const intervals = [
    { arrivalDate: "2026-01-01", departureDate: "2026-01-10" },
    { arrivalDate: "2026-01-22", departureDate: "2026-01-31" }
  ];

  assert.deepEqual(getPossibleTemporaryBreaks(intervals), []);
});

test("calculatePatternFacts merges overlap and adjacency before measuring gaps", () => {
  const stays = [
    {
      arrivalDate: "2026-01-20",
      departureDate: "2026-01-25",
      status: "planned"
    },
    {
      arrivalDate: "2026-01-01",
      departureDate: "2026-01-05",
      status: "actual"
    },
    {
      arrivalDate: "2026-01-04",
      departureDate: "2026-01-10",
      status: "planned"
    },
    {
      arrivalDate: "2026-01-11",
      departureDate: "2026-01-15",
      status: "actual"
    }
  ];
  const before = structuredClone(stays);

  const facts = calculatePatternFacts(stays);

  assert.deepEqual(facts.mergedIntervals, [
    { arrivalDate: "2026-01-01", departureDate: "2026-01-15" },
    { arrivalDate: "2026-01-20", departureDate: "2026-01-25" }
  ]);
  assert.deepEqual(facts.gapLengths, [4]);
  assert.equal(facts.gapLengths.every((length) => length > 0), true);
  assert.deepEqual(stays, before);
});

test("maxRollingTwelveMonthDays uses inclusive endpoints and the oldest tie", () => {
  const result = maxRollingTwelveMonthDays([
    {
      arrivalDate: "2025-03-01",
      departureDate: "2025-03-01",
      status: "actual"
    },
    {
      arrivalDate: "2026-02-28",
      departureDate: "2026-02-28",
      status: "planned"
    },
    {
      arrivalDate: "2026-03-01",
      departureDate: "2026-03-01",
      status: "actual"
    }
  ]);

  assert.deepEqual(result, {
    count: 2,
    windowStart: "2025-03-01",
    windowEnd: "2026-02-28"
  });
});

test("calculatePatternFacts exposes starts and gaps without classification", () => {
  const facts = calculatePatternFacts([
    {
      arrivalDate: "2026-01-01",
      departureDate: "2026-01-03",
      status: "actual"
    },
    {
      arrivalDate: "2026-01-08",
      departureDate: "2026-01-09",
      status: "planned"
    }
  ]);

  assert.deepEqual(facts.visitStartDates, ["2026-01-01", "2026-01-08"]);
  assert.deepEqual(facts.gapLengths, [4]);
  assert.equal(Object.hasOwn(facts, "periodicity"), false);
});

test("calculatePatternFacts returns exact empty facts", () => {
  assert.deepEqual(calculatePatternFacts([]), {
    mergedIntervals: [],
    visitCount: 0,
    totalDays: 0,
    longestStayDays: 0,
    visitStartDates: [],
    gapLengths: [],
    sixMonthStays: [],
    possibleTemporaryBreaks: [],
    maxRollingTwelveMonths: {
      count: 0,
      windowStart: null,
      windowEnd: null
    }
  });
});

test("calculatePatternFacts unions actual and planned dates equally", () => {
  const mixedStatuses = [
    {
      arrivalDate: "2026-01-01",
      departureDate: "2026-01-03",
      status: "actual"
    },
    {
      arrivalDate: "2026-01-03",
      departureDate: "2026-01-05",
      status: "planned"
    }
  ];
  const actualOnly = mixedStatuses.map((stay) => ({
    ...stay,
    status: "actual"
  }));

  assert.deepEqual(
    calculatePatternFacts(mixedStatuses),
    calculatePatternFacts(actualOnly)
  );
});
