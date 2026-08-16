const DAY_MS = 86_400_000;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value) {
  if (typeof value !== "string") {
    return false;
  }

  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function toEpochDay(date) {
  if (!isIsoDate(date)) {
    throw new TypeError(`Ogiltigt kalenderdatum: ${date}`);
  }

  const [year, month, day] = date.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

export function fromEpochDay(epochDay) {
  return new Date(epochDay * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(date, days) {
  return fromEpochDay(toEpochDay(date) + days);
}

export function addMonthsClamped(date, months) {
  toEpochDay(date);
  const [year, month, day] = date.split("-").map(Number);
  const targetMonthIndex = year * 12 + month - 1 + months;
  const targetYear = Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDay);

  return fromEpochDay(
    Math.floor(Date.UTC(targetYear, targetMonth, targetDay) / DAY_MS)
  );
}

export function addYearsClamped(date, years) {
  return addMonthsClamped(date, years * 12);
}

export function daysInclusive(startDate, endDate) {
  const difference = toEpochDay(endDate) - toEpochDay(startDate);
  if (difference < 0) {
    throw new RangeError(
      "Slutdatum måste vara samma dag eller senare än startdatum."
    );
  }

  return difference + 1;
}

export function eachDateInclusive(startDate, endDate) {
  const length = daysInclusive(startDate, endDate);
  return Array.from({ length }, (_, index) => addDays(startDate, index));
}

export function rollingYearEnd(startDate) {
  const anniversary = addYearsClamped(startDate, 1);
  return startDate.endsWith("-02-29") ? anniversary : addDays(anniversary, -1);
}

export function todayLocalIso(date = new Date()) {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
