import { eachDateInclusive, fromEpochDay, toEpochDay } from "./dates.js";

export function getStayDaySets(stays) {
  const actualDates = new Set();
  const plannedDates = new Set();

  for (const [group, target] of [
    [stays.filter((stay) => stay.status === "actual"), actualDates],
    [stays.filter((stay) => stay.status !== "actual"), plannedDates]
  ]) {
    for (const stay of mergeRegisteredIntervals(group)) {
      for (const date of eachDateInclusive(stay.arrivalDate, stay.departureDate)) {
        target.add(date);
      }
    }
  }

  const uniqueDates = new Set([...actualDates, ...plannedDates]);
  const statusByDate = {};
  for (const date of uniqueDates) {
    statusByDate[date] = actualDates.has(date) ? "actual" : "planned";
  }

  return { actualDates, plannedDates, uniqueDates, statusByDate };
}

function appendRange(ranges, start, end, status) {
  if (start > end) return;
  const current = ranges.at(-1);
  if (current && current.status === status && current.end + 1 === start) {
    current.end = end;
  } else {
    ranges.push({ start, end, status });
  }
}

function presentRanges(ranges) {
  return ranges.map(({ start, end, status }) => ({
    startDate: fromEpochDay(start), endDate: fromEpochDay(end), status
  }));
}

function summarizeIntervalPeriod(stays, periodStart, periodEnd) {
  const events = new Map();
  function recordEvent(day, status, change) {
    const event = events.get(day) ?? { actual: 0, planned: 0 };
    event[status] += change;
    events.set(day, event);
  }
  for (const stay of stays) {
    const status = stay.status === "actual" ? "actual" : "planned";
    recordEvent(toEpochDay(stay.arrivalDate), status, 1);
    recordEvent(toEpochDay(stay.departureDate) + 1, status, -1);
  }
  const boundaries = [...events.keys()].sort((left, right) => left - right);
  const firstDay = toEpochDay(periodStart);
  const lastDay = toEpochDay(periodEnd);
  const registeredRanges = [];
  const excludedRanges = [];
  const overlapRanges = [];
  let actual = 0;
  let planned = 0;
  let actualDays = 0;
  let plannedDays = 0;
  let uniqueDays = 0;
  let totalDays = 0;
  let overlapDays = 0;

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index];
    const end = boundaries[index + 1] - 1;
    const event = events.get(start);
    actual += event.actual;
    planned += event.planned;
    if (actual === 0 && planned === 0) continue;
    const status = actual > 0 ? "actual" : "planned";
    const includedStart = Math.max(start, firstDay);
    const includedEnd = Math.min(end, lastDay);
    const includedDays = Math.max(0, includedEnd - includedStart + 1);
    totalDays += end - start + 1;
    uniqueDays += includedDays;
    if (actual > 0) actualDays += includedDays;
    if (planned > 0) plannedDays += includedDays;
    if (actual > 0 && planned > 0) {
      overlapDays += includedDays;
      appendRange(overlapRanges, includedStart, includedEnd, "overlap");
    }
    appendRange(registeredRanges, includedStart, includedEnd, status);
    appendRange(excludedRanges, start, Math.min(end, firstDay - 1), status);
    appendRange(excludedRanges, Math.max(start, lastDay + 1), end, status);
  }

  return {
    actualDays, plannedDays, uniqueDays, excludedDays: totalDays - uniqueDays, overlapDays,
    registeredRanges: presentRanges(registeredRanges),
    excludedRanges: presentRanges(excludedRanges),
    overlapRanges: presentRanges(overlapRanges)
  };
}

export function summarizePeriod(stays, periodStart, periodEnd, { expandDates = true } = {}) {
  if (!expandDates) return summarizeIntervalPeriod(stays, periodStart, periodEnd);
  const sets = getStayDaySets(stays);
  const inside = (date) => date >= periodStart && date <= periodEnd;
  const actual = [...sets.actualDates].filter(inside).sort();
  const planned = [...sets.plannedDates].filter(inside).sort();
  const registeredDates = [...sets.uniqueDates].filter(inside).sort();
  const excludedDates = [...sets.uniqueDates]
    .filter((date) => !inside(date))
    .sort();

  return {
    actualDays: actual.length,
    plannedDays: planned.length,
    uniqueDays: registeredDates.length,
    excludedDays: excludedDates.length,
    registeredDates,
    excludedDates,
    statusByDate: sets.statusByDate
  };
}

export function mergeRegisteredIntervals(stays) {
  const sorted = stays
    .map(({ arrivalDate, departureDate }) => ({ arrivalDate, departureDate }))
    .sort((left, right) => left.arrivalDate.localeCompare(right.arrivalDate));
  const merged = [];

  for (const interval of sorted) {
    const current = merged.at(-1);
    if (!current
      || toEpochDay(interval.arrivalDate) > toEpochDay(current.departureDate) + 1) {
      merged.push({ ...interval });
    } else if (interval.departureDate > current.departureDate) {
      current.departureDate = interval.departureDate;
    }
  }

  return merged;
}

export function getPastPlannedStays(stays, today) {
  return stays
    .filter((stay) => stay.status === "planned" && stay.departureDate < today)
    .sort((left, right) => left.departureDate.localeCompare(right.departureDate));
}
