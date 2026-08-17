import { daysInclusive, isIsoDate } from "./dates.js";

const CANONICAL_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export const TRI_STATE = Object.freeze(["yes", "no", "unanswered"]);
export const CHECKLIST_KEYS = Object.freeze([
  "yearRoundHome",
  "spouseOrMinorChildren",
  "businessInSweden",
  "businessInfluence",
  "propertyInSweden",
  "otherStrongTies",
  "workDuringStays"
]);

function failed(fieldErrors, message = "Kontrollera de markerade fälten.") {
  return { ok: false, fieldErrors, message };
}

function normalizedTriState(value) {
  return value === undefined || value === null || value === ""
    ? "unanswered"
    : value;
}

function normalizedBudgetDays(value) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }
  return Number.NaN;
}

function isCanonicalTimestamp(value) {
  if (typeof value !== "string" || !CANONICAL_TIMESTAMP_PATTERN.test(value)) {
    return false;
  }

  const timestamp = Date.parse(value);
  return !Number.isNaN(timestamp) && new Date(timestamp).toISOString() === value;
}

export function validateProfile(input) {
  const fieldErrors = {};
  const departureDate = input?.departureDate;
  const periodStart = input?.periodStart;
  const periodEnd = input?.periodEnd;
  const budgetDays = normalizedBudgetDays(input?.budgetDays);

  if (!isIsoDate(departureDate)) {
    fieldErrors.departureDate = "Ange ett giltigt utflyttningsdatum.";
  }
  if (!isIsoDate(periodStart)) {
    fieldErrors.periodStart = "Ange ett giltigt startdatum.";
  }
  if (!isIsoDate(periodEnd)) {
    fieldErrors.periodEnd = "Ange ett giltigt slutdatum.";
  }

  let periodLength = null;
  if (isIsoDate(periodStart) && isIsoDate(periodEnd)) {
    if (periodEnd < periodStart) {
      fieldErrors.periodEnd = "Slutdatum måste vara samma dag eller senare än startdatum.";
    } else {
      periodLength = daysInclusive(periodStart, periodEnd);
    }
  }

  if (!Number.isInteger(budgetDays) || budgetDays < 1) {
    fieldErrors.budgetDays = "Dagbudgeten måste vara ett heltal på minst 1.";
  } else if (periodLength !== null && budgetDays > periodLength) {
    fieldErrors.budgetDays = "Dagbudgeten kan inte vara större än budgetperioden.";
  }

  const swedishCitizen = normalizedTriState(input?.swedishCitizen);
  const livedInSwedenTenYears = normalizedTriState(input?.livedInSwedenTenYears);
  if (!TRI_STATE.includes(swedishCitizen)) {
    fieldErrors.swedishCitizen = "Välj ja, nej eller obesvarad.";
  }
  if (!TRI_STATE.includes(livedInSwedenTenYears)) {
    fieldErrors.livedInSwedenTenYears = "Välj ja, nej eller obesvarad.";
  }

  const connectionChecklist = {};
  for (const key of CHECKLIST_KEYS) {
    const value = normalizedTriState(input?.connectionChecklist?.[key]);
    connectionChecklist[key] = value;
    if (!TRI_STATE.includes(value)) {
      fieldErrors["connectionChecklist." + key] = "Välj ja, nej eller obesvarad.";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failed(fieldErrors);
  }
  return {
    ok: true,
    value: {
      departureDate,
      budgetDays,
      periodStart,
      periodEnd,
      swedishCitizen,
      livedInSwedenTenYears,
      connectionChecklist
    }
  };
}

export function validateStayInput(input) {
  const fieldErrors = {};
  const arrivalDate = input?.arrivalDate;
  const departureDate = input?.departureDate;
  const status = input?.status;

  if (!isIsoDate(arrivalDate)) {
    fieldErrors.arrivalDate = "Ange ett giltigt ankomstdatum.";
  }
  if (!isIsoDate(departureDate)) {
    fieldErrors.departureDate = "Ange ett giltigt avresedatum.";
  }
  if (isIsoDate(arrivalDate) && isIsoDate(departureDate) && departureDate < arrivalDate) {
    fieldErrors.departureDate = "Avresedatum måste vara samma dag eller senare än ankomstdatum.";
  }
  if (!["actual", "planned"].includes(status)) {
    fieldErrors.status = "Välj faktisk eller planerad vistelse.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failed(fieldErrors);
  }
  return { ok: true, value: { arrivalDate, departureDate, status } };
}

export function validateAppState(input) {
  if (!input || typeof input !== "object" || input.version !== 1 || !Array.isArray(input.stays)) {
    return failed({}, "Den sparade datan har en version eller struktur som inte stöds.");
  }

  const profileResult = input.profile === null
    ? { ok: true, value: null }
    : validateProfile(input.profile);
  if (!profileResult.ok) {
    return failed(profileResult.fieldErrors, "Den sparade profilen är ogiltig.");
  }

  const stays = [];
  const stayIds = new Set();
  for (const candidate of input.stays) {
    const stayResult = validateStayInput(candidate);
    const validMetadata = typeof candidate?.id === "string"
      && candidate.id.length > 0
      && !stayIds.has(candidate.id)
      && isCanonicalTimestamp(candidate.createdAt)
      && isCanonicalTimestamp(candidate.updatedAt)
      && candidate.updatedAt >= candidate.createdAt;
    if (!stayResult.ok || !validMetadata) {
      return failed({}, "En sparad vistelse är ogiltig.");
    }
    stayIds.add(candidate.id);
    stays.push({
      id: candidate.id,
      ...stayResult.value,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt
    });
  }

  if (profileResult.value === null && stays.length > 0) {
    return failed({}, "Sparad data utan profil får inte innehålla vistelser.");
  }

  return {
    ok: true,
    value: { version: 1, profile: profileResult.value, stays }
  };
}
