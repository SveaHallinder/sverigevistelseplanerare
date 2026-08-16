import {
  addDays,
  addMonthsClamped,
  daysInclusive,
  rollingYearEnd
} from "./dates.js";
import { getStayDaySets, mergeRegisteredIntervals } from "./stays.js";

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

    if (gapEnd < sixMonthDate && matchesNeighbouringStay) {
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
    .filter((interval) => interval.departureDate >= interval.sixMonthDate);
}

export function maxRollingTwelveMonthDays(stays) {
  const dates = [...getStayDaySets(stays).uniqueDates].sort();
  let best = { count: 0, windowStart: null, windowEnd: null };
  let windowEndIndex = 0;

  for (let windowStartIndex = 0; windowStartIndex < dates.length; windowStartIndex += 1) {
    const windowStart = dates[windowStartIndex];
    const windowEnd = rollingYearEnd(windowStart);
    while (
      windowEndIndex < dates.length
      && dates[windowEndIndex] <= windowEnd
    ) {
      windowEndIndex += 1;
    }
    const count = windowEndIndex - windowStartIndex;

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
