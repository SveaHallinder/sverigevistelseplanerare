import { calculateBudget } from "./budget.js";
import { calculatePatternFacts } from "./patterns.js";

function summarizePattern(facts) {
  return {
    visitCount: facts.visitCount,
    totalDays: facts.totalDays,
    longestStayDays: facts.longestStayDays,
    gapLengths: [...facts.gapLengths]
  };
}

export function buildBudgetExplanation(profile, stays) {
  const budget = calculateBudget(profile, stays, { expandDates: false });
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
      overlapDays: budget.overlapDays,
      excludedDays: budget.excludedDays,
      remaining: budget.remaining,
      overBy: budget.overBy
    },
    boundary: {
      lastWithinBudgetDate: budget.lastWithinBudgetDate,
      firstExceededDate: budget.firstExceededDate
    },
    includedRanges: budget.registeredRanges,
    excludedRanges: budget.excludedRanges,
    overlapRanges: budget.overlapRanges,
    actualPattern: summarizePattern(calculatePatternFacts(actualStays)),
    scenarioPattern: summarizePattern(calculatePatternFacts(stays)),
    hasPlannedStays: stays.some((stay) => stay.status === "planned")
  };
}
