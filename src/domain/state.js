import { validateProfile, validateStayInput } from "./validation.js";

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

  const stays = state.stays.map((stay) => stay.id === id
    ? { ...current, ...result.value, updatedAt: timestamp }
    : stay);
  return { ok: true, value: { ...state, stays } };
}

export function removeStay(state, id) {
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
