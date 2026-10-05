import assert from "node:assert/strict";
import test from "node:test";
import * as staysApi from "../src/domain/stays.js";

const {
  getPastPlannedStays,
  getStayDaySets,
  mergeRegisteredIntervals,
  summarizePeriod
} = staysApi;

test("stays exports only the documented API", () => {
  assert.deepEqual(Object.keys(staysApi).sort(), [
    "getPastPlannedStays",
    "getStayDaySets",
    "mergeRegisteredIntervals",
    "summarizePeriod"
  ]);
});

test("getStayDaySets deduplicates dates while actual status wins overlaps", () => {
  const stays = [
    {
      id: "actual-1",
      arrivalDate: "2026-01-01",
      departureDate: "2026-01-03",
      status: "actual"
    },
    {
      id: "planned-1",
      arrivalDate: "2026-01-03",
      departureDate: "2026-01-05",
      status: "planned"
    }
  ];
  const before = structuredClone(stays);

  const result = getStayDaySets(stays);

  assert.deepEqual([...result.actualDates].sort(), [
    "2026-01-01",
    "2026-01-02",
    "2026-01-03"
  ]);
  assert.deepEqual([...result.plannedDates].sort(), [
    "2026-01-03",
    "2026-01-04",
    "2026-01-05"
  ]);
  assert.deepEqual([...result.uniqueDates].sort(), [
    "2026-01-01",
    "2026-01-02",
    "2026-01-03",
    "2026-01-04",
    "2026-01-05"
  ]);
  assert.deepEqual(result.statusByDate, {
    "2026-01-01": "actual",
    "2026-01-02": "actual",
    "2026-01-03": "actual",
    "2026-01-04": "planned",
    "2026-01-05": "planned"
  });
  assert.deepEqual(stays, before);
});

test("getStayDaySets preserves same-status unions and cross-status overlap", () => {
  const stays = [
    { arrivalDate: "2028-03-01", departureDate: "2028-03-03", status: "planned" },
    { arrivalDate: "2028-02-28", departureDate: "2028-03-01", status: "actual" },
    { arrivalDate: "2028-02-29", departureDate: "2028-03-02", status: "planned" },
    { arrivalDate: "2028-02-28", departureDate: "2028-02-29", status: "actual" }
  ];
  const before = structuredClone(stays);
  const result = getStayDaySets(stays);

  assert.deepEqual([...result.actualDates].sort(), ["2028-02-28", "2028-02-29", "2028-03-01"]);
  assert.deepEqual([...result.plannedDates].sort(), ["2028-02-29", "2028-03-01", "2028-03-02", "2028-03-03"]);
  assert.deepEqual([...result.uniqueDates].sort(), ["2028-02-28", "2028-02-29", "2028-03-01", "2028-03-02", "2028-03-03"]);
  assert.equal(result.statusByDate["2028-02-29"], "actual");
  assert.equal(result.statusByDate["2028-03-03"], "planned");
  assert.deepEqual(stays, before);
});

test("getStayDaySets bounds calendar work by unique dates for repeated stays", (context) => {
  const stays = Array.from({ length: 100 }, () => ({
    arrivalDate: "2026-01-01",
    departureDate: "2026-12-31",
    status: "actual"
  }));
  const utc = Date.UTC;
  let calendarCalls = 0;
  context.mock.method(Date, "UTC", (...args) => {
    calendarCalls += 1;
    return utc(...args);
  });

  const result = getStayDaySets(stays);

  assert.equal(result.actualDates.size, 365);
  assert.equal(result.uniqueDates.size, 365);
  assert.equal(result.plannedDates.size, 0);
  assert.ok(
    calendarCalls <= result.uniqueDates.size * 8 + stays.length * 8,
    "Överlappande vistelser ska inte upprepa kalenderarbetet för varje råintervall."
  );
});

test("summarizePeriod counts actual and planned overlaps separately", () => {
  const result = summarizePeriod([
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
  ], "2026-01-01", "2026-12-31");

  assert.equal(result.actualDays, 3);
  assert.equal(result.plannedDays, 3);
  assert.equal(result.uniqueDays, 5);
  assert.equal(result.excludedDays, 0);
  assert.deepEqual(result.registeredDates, [
    "2026-01-01",
    "2026-01-02",
    "2026-01-03",
    "2026-01-04",
    "2026-01-05"
  ]);
  assert.deepEqual(result.excludedDates, []);
  assert.equal(result.statusByDate["2026-01-03"], "actual");
});

test("summarizePeriod clips inclusive intervals and reports excluded dates", () => {
  const result = summarizePeriod([{
    arrivalDate: "2025-12-30",
    departureDate: "2026-01-03",
    status: "actual"
  }], "2026-01-01", "2026-12-31");

  assert.deepEqual(result, {
    actualDays: 3,
    plannedDays: 0,
    uniqueDays: 3,
    excludedDays: 2,
    registeredDates: ["2026-01-01", "2026-01-02", "2026-01-03"],
    excludedDates: ["2025-12-30", "2025-12-31"],
    statusByDate: {
      "2025-12-30": "actual",
      "2025-12-31": "actual",
      "2026-01-01": "actual",
      "2026-01-02": "actual",
      "2026-01-03": "actual"
    }
  });
});

test("mergeRegisteredIntervals merges overlap and direct adjacency without mutation", () => {
  const stays = [
    {
      id: "later",
      arrivalDate: "2026-01-10",
      departureDate: "2026-01-12",
      status: "planned"
    },
    {
      id: "first",
      arrivalDate: "2026-01-01",
      departureDate: "2026-01-03",
      status: "actual"
    },
    {
      id: "overlap",
      arrivalDate: "2026-01-02",
      departureDate: "2026-01-05",
      status: "planned"
    },
    {
      id: "adjacent",
      arrivalDate: "2026-01-06",
      departureDate: "2026-01-08",
      status: "actual"
    }
  ];
  const before = structuredClone(stays);

  const result = mergeRegisteredIntervals(stays);

  assert.deepEqual(result, [
    { arrivalDate: "2026-01-01", departureDate: "2026-01-08" },
    { arrivalDate: "2026-01-10", departureDate: "2026-01-12" }
  ]);
  assert.deepEqual(stays, before);
  assert.deepEqual(mergeRegisteredIntervals([]), []);
});

test("mergeRegisteredIntervals merges overlap at the final supported date", () => {
  assert.deepEqual(mergeRegisteredIntervals([
    { arrivalDate: "9999-12-30", departureDate: "9999-12-31" },
    { arrivalDate: "9999-12-31", departureDate: "9999-12-31" }
  ]), [{ arrivalDate: "9999-12-30", departureDate: "9999-12-31" }]);
});

test("getPastPlannedStays excludes today and sorts past plans by departure", () => {
  const stays = [
    {
      id: "today",
      arrivalDate: "2026-08-15",
      departureDate: "2026-08-16",
      status: "planned"
    },
    {
      id: "later-past",
      arrivalDate: "2026-08-10",
      departureDate: "2026-08-14",
      status: "planned"
    },
    {
      id: "actual",
      arrivalDate: "2026-08-01",
      departureDate: "2026-08-02",
      status: "actual"
    },
    {
      id: "earlier-past",
      arrivalDate: "2026-08-03",
      departureDate: "2026-08-05",
      status: "planned"
    }
  ];
  const before = structuredClone(stays);

  const result = getPastPlannedStays(stays, "2026-08-16");

  assert.deepEqual(result.map((stay) => stay.id), ["earlier-past", "later-past"]);
  assert.deepEqual(stays, before);
});
