import { calculateBudget } from "./budget.js";
import { addDays } from "./dates.js";
import { calculatePatternFacts } from "./patterns.js";
import { getStayDaySets } from "./stays.js";

function rangesFor(dates, statusForDate) {
  const ranges = [];
  for (const date of [...dates].sort()) {
    const status = statusForDate(date);
    const current = ranges.at(-1);
    if (
      current
      && current.status === status
      && date === addDays(current.endDate, 1)
    ) {
      current.endDate = date;
    } else {
      ranges.push({ startDate: date, endDate: date, status });
    }
  }
  return ranges;
}

function summarizePattern(facts) {
  return {
    visitCount: facts.visitCount,
    totalDays: facts.totalDays,
    longestStayDays: facts.longestStayDays,
    gapLengths: [...facts.gapLengths]
  };
}

export function buildBudgetExplanation(profile, stays) {
  const budget = calculateBudget(profile, stays);
  const sets = getStayDaySets(stays);
  const overlapDates = [...sets.actualDates].filter((date) =>
    sets.plannedDates.has(date)
    && date >= profile.periodStart
    && date <= profile.periodEnd);
  const actualStays = stays.filter((stay) => stay.status === "actual");

  return {
    period: {
      startDate: profile.periodStart,
      endDate: profile.periodEnd,
      budgetDays: profile.budgetDays
    },
    totals: {
      actualDays: budget.actualDays,
      plannedDays: budget.plannedDays,
      uniqueDays: budget.uniqueDays,
      overlapDays: overlapDates.length,
      excludedDays: budget.excludedDays,
      remaining: budget.remaining,
      overBy: budget.overBy
    },
    boundary: {
      lastWithinBudgetDate: budget.lastWithinBudgetDate,
      firstExceededDate: budget.firstExceededDate
    },
    includedRanges: rangesFor(
      budget.registeredDates,
      (date) => budget.statusByDate[date]
    ),
    excludedRanges: rangesFor(
      budget.excludedDates,
      (date) => budget.statusByDate[date]
    ),
    overlapRanges: rangesFor(overlapDates, () => "overlap"),
    actualPattern: summarizePattern(calculatePatternFacts(actualStays)),
    scenarioPattern: summarizePattern(calculatePatternFacts(stays)),
    hasPlannedStays: stays.some((stay) => stay.status === "planned"),
    rules: {
      inclusiveEndpoints: true,
      uniqueBudgetDates: true,
      actualPresentationPrecedence: true
    }
  };
}
