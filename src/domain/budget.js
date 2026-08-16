import { eachDateInclusive } from "./dates.js";
import { summarizePeriod } from "./stays.js";

export function calculateBudget(profile, stays) {
  const summary = summarizePeriod(stays, profile.periodStart, profile.periodEnd);
  const remaining = profile.budgetDays - summary.uniqueDays;

  return {
    ...summary,
    remaining,
    overBy: Math.max(0, -remaining),
    lastWithinBudgetDate: summary.uniqueDays >= profile.budgetDays
      ? summary.registeredDates[profile.budgetDays - 1]
      : null,
    firstExceededDate: summary.uniqueDays > profile.budgetDays
      ? summary.registeredDates[profile.budgetDays]
      : null
  };
}

export function evaluatePlannedStay(
  profile,
  stays,
  candidate,
  { excludeStayId } = {}
) {
  const baseStays = excludeStayId
    ? stays.filter((stay) => stay.id !== excludeStayId)
    : stays;
  const combinedStays = [...baseStays, { ...candidate, status: "planned" }];
  const result = calculateBudget(profile, combinedStays);
  const rankByDate = new Map(
    result.registeredDates.map((date, index) => [date, index + 1])
  );
  const candidateDates = eachDateInclusive(
    candidate.arrivalDate,
    candidate.departureDate
  ).filter((date) => date >= profile.periodStart && date <= profile.periodEnd);
  const candidateWithin = candidateDates.filter(
    (date) => rankByDate.get(date) <= profile.budgetDays
  );
  const candidateOver = candidateDates.filter(
    (date) => rankByDate.get(date) > profile.budgetDays
  );

  return {
    ...result,
    candidateLastWithinBudgetDate: candidateWithin.at(-1) ?? null,
    candidateFirstExceededDate: candidateOver[0] ?? null
  };
}
