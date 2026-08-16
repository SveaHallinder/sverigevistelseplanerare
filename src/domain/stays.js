import { addDays, eachDateInclusive } from "./dates.js";

export function getStayDaySets(stays) {
  const actualDates = new Set();
  const plannedDates = new Set();

  for (const stay of stays) {
    const target = stay.status === "actual" ? actualDates : plannedDates;
    for (const date of eachDateInclusive(stay.arrivalDate, stay.departureDate)) {
      target.add(date);
    }
  }

  const uniqueDates = new Set([...actualDates, ...plannedDates]);
  const statusByDate = {};
  for (const date of uniqueDates) {
    statusByDate[date] = actualDates.has(date) ? "actual" : "planned";
  }

  return { actualDates, plannedDates, uniqueDates, statusByDate };
}

export function summarizePeriod(stays, periodStart, periodEnd) {
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
    if (!current || interval.arrivalDate > addDays(current.departureDate, 1)) {
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
