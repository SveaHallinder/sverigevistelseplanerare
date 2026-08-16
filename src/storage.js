import { validateAppState } from "./domain/validation.js";

export const STORAGE_KEY = "sverigevistelseplanerare:state:v1";

function issue(code, message) {
  return { code, message };
}

function fallbackIssue(mode) {
  if (mode === "session") {
    return issue("session-fallback", "Data kan försvinna när sidan stängs.");
  }
  if (mode === "memory") {
    return issue("memory-fallback", "Data försvinner när sidan laddas om.");
  }
  return null;
}

function storageConflictIssue() {
  return issue(
    "storage-conflict",
    "Äldre lokal data kunde inte ersättas. Rensa appdatan och försök igen."
  );
}

export function decodeStoredState(raw) {
  if (raw === null) {
    return { ok: true, state: null, issue: null };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      state: null,
      issue: issue(
        "invalid-json",
        "Sparad data kunde inte läsas. Rensa den för att börja om."
      )
    };
  }

  if (parsed?.version !== 1) {
    return {
      ok: false,
      state: null,
      issue: issue(
        "unsupported-version",
        "Den sparade dataversionen stöds inte. Datan har inte skrivits över."
      )
    };
  }

  const result = validateAppState(parsed);
  return result.ok
    ? { ok: true, state: result.value, issue: null }
    : {
        ok: false,
        state: null,
        issue: issue(
          "invalid-state",
          "Sparad data har en ogiltig struktur. Rensa den för att börja om."
        )
      };
}

export function serializeAppState(state) {
  let isDemo;
  try {
    isDemo = state?.demo === true;
  } catch {
    throw new TypeError("Den sparade datan har en version eller struktur som inte stöds.");
  }
  if (isDemo) {
    throw new TypeError("Demoexemplet får inte sparas.");
  }

  let result;
  try {
    result = validateAppState(state);
  } catch {
    throw new TypeError("Den sparade datan har en version eller struktur som inte stöds.");
  }
  if (!result.ok) {
    throw new TypeError(result.message);
  }
  try {
    return JSON.stringify(result.value);
  } catch {
    throw new TypeError("Den sparade datan har en version eller struktur som inte stöds.");
  }
}

export function createStateRepository({
  localStorage = null,
  sessionStorage = null
} = {}) {
  let mode = "memory";
  let memoryRaw = null;
  let locked = false;

  function read(storage) {
    if (!storage) {
      return { accessible: false, raw: null };
    }
    try {
      return { accessible: true, raw: storage.getItem(STORAGE_KEY) };
    } catch {
      return { accessible: false, raw: null };
    }
  }

  mode = read(localStorage).accessible
    ? "local"
    : read(sessionStorage).accessible ? "session" : "memory";

  function load() {
    const local = read(localStorage);
    const session = read(sessionStorage);
    let raw = null;

    if (local.raw !== null && session.raw !== null && local.raw !== session.raw) {
      locked = true;
      mode = "local";
      return { state: null, issue: storageConflictIssue(), mode };
    }

    if (local.raw !== null) {
      raw = local.raw;
      mode = "local";
    } else if (session.raw !== null) {
      raw = session.raw;
      mode = "session";
    } else if (memoryRaw !== null) {
      raw = memoryRaw;
      mode = "memory";
    } else if (local.accessible) {
      mode = "local";
    } else if (session.accessible) {
      mode = "session";
    } else {
      mode = "memory";
    }

    const decoded = decodeStoredState(raw);
    if (!decoded.ok) {
      locked = true;
    }
    return {
      state: decoded.state,
      issue: decoded.issue ?? fallbackIssue(mode),
      mode
    };
  }

  function tryWrite(storage, nextMode, raw) {
    if (!storage) {
      return false;
    }
    try {
      storage.setItem(STORAGE_KEY, raw);
      mode = nextMode;
      return true;
    } catch {
      return false;
    }
  }

  function localFallbackStatus(raw) {
    if (localStorage === null) {
      return "available";
    }
    const local = read(localStorage);
    if (!local.accessible) {
      mode = "local";
      return "conflict";
    }
    if (local.raw === null) {
      return "available";
    }
    if (local.raw === raw) {
      mode = "local";
      return "saved";
    }

    mode = "local";
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      return "conflict";
    }
    const verified = read(localStorage);
    return verified.accessible && verified.raw === null
      ? "available"
      : "conflict";
  }

  function sessionFallbackStatus(raw) {
    if (sessionStorage === null) {
      return "available";
    }
    const session = read(sessionStorage);
    if (!session.accessible) {
      mode = "session";
      return "conflict";
    }
    if (session.raw === null) {
      return "available";
    }
    if (session.raw === raw) {
      mode = "session";
      return "saved";
    }

    mode = "session";
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      return "conflict";
    }
    const verified = read(sessionStorage);
    return verified.accessible && verified.raw === null
      ? "available"
      : "conflict";
  }

  function storageConflict() {
    locked = true;
    return {
      ok: false,
      issue: storageConflictIssue(),
      mode
    };
  }

  function neutralizeSession(raw) {
    if (sessionStorage === null) {
      return true;
    }
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      const removed = read(sessionStorage);
      if (removed.accessible && removed.raw === null) {
        return true;
      }
    } catch {
      // Verifierad overwrite provas nedan.
    }

    try {
      sessionStorage.setItem(STORAGE_KEY, raw);
    } catch {
      // Read-back avgör om skrivningen ändå hann lyckas.
    }
    const overwritten = read(sessionStorage);
    return overwritten.accessible && overwritten.raw === raw;
  }

  function save(state) {
    if (locked) {
      return {
        ok: false,
        issue: issue(
          "clear-required",
          "Rensa den inkompatibla datan innan en ny profil sparas."
        ),
        mode
      };
    }

    let raw;
    try {
      raw = serializeAppState(state);
    } catch (error) {
      return {
        ok: false,
        issue: issue("invalid-state", error.message),
        mode
      };
    }

    if (tryWrite(localStorage, "local", raw)) {
      memoryRaw = null;
      if (!neutralizeSession(raw)) {
        return storageConflict();
      }
      return { ok: true, issue: null, mode };
    }

    const fallbackStatus = localFallbackStatus(raw);
    if (fallbackStatus === "saved") {
      memoryRaw = null;
      if (!neutralizeSession(raw)) {
        return storageConflict();
      }
      return { ok: true, issue: null, mode };
    }
    if (fallbackStatus === "conflict") {
      return storageConflict();
    }
    if (tryWrite(sessionStorage, "session", raw)) {
      memoryRaw = null;
      return { ok: true, issue: fallbackIssue(mode), mode };
    }

    const memoryStatus = sessionFallbackStatus(raw);
    if (memoryStatus === "saved") {
      memoryRaw = null;
      return { ok: true, issue: fallbackIssue(mode), mode };
    }
    if (memoryStatus === "conflict") {
      return storageConflict();
    }

    memoryRaw = raw;
    mode = "memory";
    return { ok: true, issue: fallbackIssue(mode), mode };
  }

  function clear() {
    for (const storage of [localStorage, sessionStorage]) {
      try {
        storage?.removeItem(STORAGE_KEY);
      } catch {
        // Rensning fortsätter i övriga tillgängliga lager.
      }
    }
    memoryRaw = null;
    locked = false;

    const localAvailable = read(localStorage).accessible;
    const sessionAvailable = read(sessionStorage).accessible;
    mode = localAvailable ? "local" : sessionAvailable ? "session" : "memory";
    return { ok: true, issue: null, mode };
  }

  return {
    load,
    save,
    clear,
    get mode() {
      return mode;
    }
  };
}
