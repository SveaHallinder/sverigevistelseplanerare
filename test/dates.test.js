import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  addMonthsClamped,
  addYearsClamped,
  daysInclusive,
  eachDateInclusive,
  fromEpochDay,
  isIsoDate,
  rollingYearEnd,
  todayLocalIso,
  toEpochDay
} from "../src/domain/dates.js";

test("isIsoDate accepts real ISO calendar dates only", () => {
  assert.equal(isIsoDate("2028-02-29"), true);
  assert.equal(isIsoDate("2026-02-29"), false);
  assert.equal(isIsoDate("16-08-2026"), false);
});

test("epoch-day conversion round-trips valid dates", () => {
  assert.equal(fromEpochDay(toEpochDay("2026-08-16")), "2026-08-16");
});

test("toEpochDay rejects invalid calendar dates", () => {
  assert.throws(
    () => toEpochDay("2026-02-29"),
    { name: "TypeError", message: "Ogiltigt kalenderdatum: 2026-02-29" }
  );
});

test("daysInclusive counts both endpoints and rejects reverse intervals", () => {
  assert.equal(daysInclusive("2026-08-16", "2026-08-16"), 1);
  assert.throws(
    () => daysInclusive("2026-08-17", "2026-08-16"),
    {
      name: "RangeError",
      message: "Slutdatum måste vara samma dag eller senare än startdatum."
    }
  );
});

test("eachDateInclusive crosses year boundaries", () => {
  assert.deepEqual(eachDateInclusive("2025-12-30", "2026-01-03"), [
    "2025-12-30",
    "2025-12-31",
    "2026-01-01",
    "2026-01-02",
    "2026-01-03"
  ]);
});

test("inclusive day counts are stable across DST boundaries", () => {
  assert.equal(daysInclusive("2026-03-28", "2026-03-30"), 3);
  assert.equal(daysInclusive("2026-10-24", "2026-10-26"), 3);
});

test("month and year addition clamps to the target month's last day", () => {
  assert.equal(addMonthsClamped("2026-08-31", 6), "2027-02-28");
  assert.equal(addYearsClamped("2028-02-29", 5), "2033-02-28");
});

test("rollingYearEnd handles leap-day and ordinary starts", () => {
  assert.equal(rollingYearEnd("2024-02-29"), "2025-02-28");
  assert.equal(rollingYearEnd("2025-03-01"), "2026-02-28");
});

test("todayLocalIso uses local date parts from the injected date", () => {
  assert.equal(todayLocalIso(new Date(2026, 7, 16, 23, 30)), "2026-08-16");
});

test("addDays crosses year boundaries", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});
