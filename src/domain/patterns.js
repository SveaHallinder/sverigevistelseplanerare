import {
  addDays,
  addMonthsClamped,
  daysInclusive,
  fromEpochDay,
  rollingYearEnd,
  toEpochDay
} from "./dates.js";
import { mergeRegisteredIntervals } from "./stays.js";

function calendarTimestamp(date) {
  return Date.parse(date + "T00:00:00Z");
}

export function getPossibleTemporaryBreaks(mergedIntervals) {
  const observations = [];

  for (let index = 0; index < mergedIntervals.length - 1; index += 1) {
    const before = mergedIntervals[index];
    const after = mergedIntervals[index + 1];
    const gapStart = addDays(before.departureDate, 1);
    const gapEnd = addDays(after.arrivalDate, -1);
    const gapDays = daysInclusive(gapStart, gapEnd);
    const beforeDays = daysInclusive(before.arrivalDate, before.departureDate);
    const afterDays = daysInclusive(after.arrivalDate, after.departureDate);

    const sixMonthDate = addMonthsClamped(gapStart, 6);
    const matchesNeighbouringStay = gapDays <= beforeDays || gapDays <= afterDays;

    if (calendarTimestamp(gapEnd) < calendarTimestamp(sixMonthDate)
      && matchesNeighbouringStay) {
      observations.push({
        before,
        after,
        gapStart,
        gapEnd,
        gapDays,
        beforeDays,
        afterDays
      });
    }
  }

  return observations;
}

export function getSixMonthStays(mergedIntervals) {
  return mergedIntervals
    .map((interval) => ({
      ...interval,
      sixMonthDate: addMonthsClamped(interval.arrivalDate, 6)
    }))
    .filter((interval) =>
      calendarTimestamp(interval.departureDate) >= calendarTimestamp(interval.sixMonthDate));
}

export function maxRollingTwelveMonthDays(stays) {
  const merged = mergeRegisteredIntervals(stays);
  let best = { count: 0, windowStart: null, windowEnd: null };
  if (merged.length === 0) return best;
  let total = 0;
  const intervals = merged.map((stay) => {
    const start = toEpochDay(stay.arrivalDate);
    const end = toEpochDay(stay.departureDate);
    const before = total;
    total += end - start + 1;
    return { start, end, before };
  });
  const candidates = new Set(intervals.map((interval) => interval.start));
  const firstYear = Number(merged[0].arrivalDate.slice(0, 4));
  const lastYear = Number(merged.at(-1).departureDate.slice(0, 4));
  let intervalIndex = 0;

  // Inside a registered interval a shifted window loses one day and adds at most one.
  // Only 1 March before a leap year can advance the window's end by two days.
  for (let year = firstYear; year <= lastYear; year += 1) {
    if (new Date(Date.UTC(year + 1, 2, 0)).getUTCDate() !== 29) continue;
    const day = Date.UTC(year, 2, 1) / 86_400_000;
    while (intervalIndex < intervals.length && intervals[intervalIndex].end < day) {
      intervalIndex += 1;
    }
    if (intervalIndex < intervals.length && intervals[intervalIndex].start <= day) {
      candidates.add(day);
    }
  }

  function countThrough(day) {
    let low = 0;
    let high = intervals.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (intervals[middle].start <= day) low = middle + 1;
      else high = middle;
    }
    if (low === 0) return 0;
    const interval = intervals[low - 1];
    return interval.before + Math.min(day, interval.end) - interval.start + 1;
  }

  for (const day of [...candidates].sort((left, right) => left - right)) {
    const windowStart = fromEpochDay(day);
    const windowEnd = rollingYearEnd(windowStart);
    const windowEndDay = calendarTimestamp(windowEnd) / 86_400_000;
    const count = countThrough(windowEndDay) - countThrough(day - 1);

    if (count > best.count) {
      best = { count, windowStart, windowEnd };
    }
  }

  return best;
}

export function calculatePatternFacts(stays) {
  const mergedIntervals = mergeRegisteredIntervals(stays);
  const lengths = mergedIntervals.map((interval) =>
    daysInclusive(interval.arrivalDate, interval.departureDate));
  const gaps = mergedIntervals.slice(0, -1).map((interval, index) => {
    const next = mergedIntervals[index + 1];
    return daysInclusive(
      addDays(interval.departureDate, 1),
      addDays(next.arrivalDate, -1)
    );
  });

  return {
    mergedIntervals,
    visitCount: mergedIntervals.length,
    totalDays: lengths.reduce((sum, value) => sum + value, 0),
    longestStayDays: lengths.length === 0 ? 0 : Math.max(...lengths),
    visitStartDates: mergedIntervals.map((interval) => interval.arrivalDate),
    gapLengths: gaps,
    sixMonthStays: getSixMonthStays(mergedIntervals),
    possibleTemporaryBreaks: getPossibleTemporaryBreaks(mergedIntervals),
    maxRollingTwelveMonths: maxRollingTwelveMonthDays(stays)
  };
}
