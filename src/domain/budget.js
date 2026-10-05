import { addDays, daysInclusive, eachDateInclusive } from "./dates.js";
import { summarizePeriod } from "./stays.js";

function registeredDateAt(ranges, rank) {
  for (const range of ranges) {
    const days = daysInclusive(range.startDate, range.endDate);
    if (rank <= days) return addDays(range.startDate, rank - 1);
    rank -= days;
  }
  return null;
}

export function calculateBudget(profile, stays, { expandDates = true } = {}) {
  const summary = summarizePeriod(stays, profile.periodStart, profile.periodEnd, { expandDates });
  const remaining = profile.budgetDays - summary.uniqueDays;
  const dateAt = (rank) => expandDates
    ? summary.registeredDates[rank - 1]
    : registeredDateAt(summary.registeredRanges, rank);

  return {
    ...summary,
    remaining,
    overBy: Math.max(0, -remaining),
    lastWithinBudgetDate: summary.uniqueDays >= profile.budgetDays
      ? dateAt(profile.budgetDays)
      : null,
    firstExceededDate: summary.uniqueDays > profile.budgetDays
      ? dateAt(profile.budgetDays + 1)
      : null
  };
}

export function evaluatePlannedStay(
  profile,
  stays,
  candidate,
  { excludeStayId, expandDates = true } = {}
) {
  const baseStays = excludeStayId
    ? stays.filter((stay) => stay.id !== excludeStayId)
    : stays;
  const combinedStays = [...baseStays, { ...candidate, status: "planned" }];
  const result = calculateBudget(profile, combinedStays, { expandDates });
  const base = summarizePeriod(baseStays, profile.periodStart, profile.periodEnd, { expandDates });
  const candidateNewDays = result.uniqueDays - base.uniqueDays;
  if (!expandDates) {
    const start = candidate.arrivalDate > profile.periodStart ? candidate.arrivalDate : profile.periodStart;
    const end = candidate.departureDate < profile.periodEnd ? candidate.departureDate : profile.periodEnd;
    const candidateDays = daysInclusive(candidate.arrivalDate, candidate.departureDate);
    const candidateDaysInPeriod = start <= end ? daysInclusive(start, end) : 0;
    const withinEnd = result.lastWithinBudgetDate ?? end;
    return {
      ...result,
      candidateDays,
      candidateDaysInPeriod,
      candidateNewDays,
      candidateOverlapDays: candidateDaysInPeriod - candidateNewDays,
      candidateDaysOutsidePeriod: candidateDays - candidateDaysInPeriod,
      candidateLastWithinBudgetDate: candidateDaysInPeriod > 0 && start <= withinEnd
        ? (end < withinEnd ? end : withinEnd) : null,
      candidateFirstExceededDate: candidateDaysInPeriod > 0 && result.firstExceededDate
        && end >= result.firstExceededDate
        ? (start > result.firstExceededDate ? start : result.firstExceededDate) : null
    };
  }
  const rankByDate = new Map(
    result.registeredDates.map((date, index) => [date, index + 1])
  );
  const allCandidateDates = eachDateInclusive(
    candidate.arrivalDate,
    candidate.departureDate
  );
  const candidateDates = allCandidateDates.filter(
    (date) => date >= profile.periodStart && date <= profile.periodEnd
  );
  const candidateWithin = candidateDates.filter(
    (date) => rankByDate.get(date) <= profile.budgetDays
  );
  const candidateOver = candidateDates.filter(
    (date) => rankByDate.get(date) > profile.budgetDays
  );

  return {
    ...result,
    candidateDays: allCandidateDates.length,
    candidateDaysInPeriod: candidateDates.length,
    candidateNewDays,
    candidateOverlapDays: candidateDates.length - candidateNewDays,
    candidateDaysOutsidePeriod: allCandidateDates.length - candidateDates.length,
    candidateLastWithinBudgetDate: candidateWithin.at(-1) ?? null,
    candidateFirstExceededDate: candidateOver[0] ?? null
  };
}
