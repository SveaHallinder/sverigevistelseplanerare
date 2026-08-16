import { validateProfile, validateStayInput } from "./validation.js";

const CANONICAL_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DUPLICATE_STAY_ID_MESSAGE =
  "Vistelsen kunde inte hanteras eftersom datan innehåller dubbletter.";
const INVALID_STAY_METADATA_MESSAGE =
  "Vistelsen kunde inte sparas eftersom id eller tidsstämpel är ogiltig.";

function duplicateStayIdError() {
  return { ok: false, fieldErrors: {}, message: DUPLICATE_STAY_ID_MESSAGE };
}

function invalidStayMetadataError() {
  return { ok: false, fieldErrors: {}, message: INVALID_STAY_METADATA_MESSAGE };
}

function hasDuplicateStayIds(stays) {
  return new Set(stays.map((stay) => stay.id)).size !== stays.length;
}

function isCanonicalTimestamp(value) {
  if (typeof value !== "string" || !CANONICAL_TIMESTAMP_PATTERN.test(value)) {
    return false;
  }

  const timestamp = Date.parse(value);
  return !Number.isNaN(timestamp) && new Date(timestamp).toISOString() === value;
}

export function createEmptyState() {
  return { version: 1, profile: null, stays: [] };
}

export function setProfile(state, input) {
  const result = validateProfile(input);
  return result.ok
    ? { ok: true, value: { ...state, profile: result.value } }
    : result;
}

export function addStay(state, input, { id, timestamp }) {
  const result = validateStayInput(input);
  if (!result.ok) {
    return result;
  }
  if (typeof id !== "string" || id.length === 0 || !isCanonicalTimestamp(timestamp)) {
    return invalidStayMetadataError();
  }
  if (state.stays.some((stay) => stay.id === id)) {
    return duplicateStayIdError();
  }

  const stay = {
    id,
    ...result.value,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  return {
    ok: true,
    value: { ...state, stays: [...state.stays, stay] }
  };
}

export function updateStay(state, id, input, { timestamp }) {
  if (hasDuplicateStayIds(state.stays)) {
    return duplicateStayIdError();
  }

  const current = state.stays.find((stay) => stay.id === id);
  if (!current) {
    return {
      ok: false,
      fieldErrors: {},
      message: "Vistelsen kunde inte hittas."
    };
  }

  const result = validateStayInput(input);
  if (!result.ok) {
    return result;
  }
  if (!isCanonicalTimestamp(current.createdAt)
    || !isCanonicalTimestamp(timestamp)
    || timestamp < current.createdAt) {
    return invalidStayMetadataError();
  }

  const stays = state.stays.map((stay) => stay.id === id
    ? { ...current, ...result.value, updatedAt: timestamp }
    : stay);
  return { ok: true, value: { ...state, stays } };
}

export function removeStay(state, id) {
  if (hasDuplicateStayIds(state.stays)) {
    return duplicateStayIdError();
  }

  if (!state.stays.some((stay) => stay.id === id)) {
    return {
      ok: false,
      fieldErrors: {},
      message: "Vistelsen kunde inte hittas."
    };
  }

  return {
    ok: true,
    value: {
      ...state,
      stays: state.stays.filter((stay) => stay.id !== id)
    }
  };
}
