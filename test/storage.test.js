import assert from "node:assert/strict";
import test from "node:test";
import * as storageApi from "../src/storage.js";

const {
  STORAGE_KEY,
  createStateRepository,
  decodeStoredState,
  serializeAppState
} = storageApi;

const SESSION_ISSUE = {
  code: "session-fallback",
  message: "Data kan försvinna när sidan stängs."
};

const MEMORY_ISSUE = {
  code: "memory-fallback",
  message: "Data försvinner när sidan laddas om."
};

const STORAGE_CONFLICT_ISSUE = {
  code: "storage-conflict",
  message: "Äldre lokal data kunde inte ersättas. Rensa appdatan och försök igen."
};

const CLEAR_FAILED_ISSUE = {
  code: "clear-failed",
  message: "All appdata kunde inte rensas. Försök igen."
};

const validProfile = {
  departureDate: "2025-05-10",
  budgetDays: 90,
  periodStart: "2026-01-01",
  periodEnd: "2026-12-31",
  swedishCitizen: "yes",
  livedInSwedenTenYears: "unanswered",
  connectionChecklist: {
    yearRoundHome: "no",
    spouseOrMinorChildren: "no",
    businessInSweden: "no",
    businessInfluence: "no",
    propertyInSweden: "no",
    otherStrongTies: "unanswered",
    workDuringStays: "no"
  }
};

const validStay = {
  id: "stay-private-1",
  arrivalDate: "2026-08-01",
  departureDate: "2026-08-03",
  status: "planned",
  createdAt: "2026-08-16T12:00:00.000Z",
  updatedAt: "2026-08-16T12:00:00.000Z"
};

const validState = {
  version: 1,
  profile: validProfile,
  stays: [validStay]
};

function createFakeStorage(initial = {}, failures = {}) {
  const values = new Map(Object.entries(initial));
  const calls = {
    getItem: [],
    setItem: [],
    removeItem: []
  };
  const fail = {
    getItem: false,
    setItem: false,
    removeItem: false,
    ...failures
  };

  return {
    calls,
    fail,
    values,
    getItem(key) {
      calls.getItem.push(key);
      if (fail.getItem) throw new Error("getItem failed");
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      calls.setItem.push([key, value]);
      if (fail.setItem) throw new Error("setItem failed");
      values.set(key, value);
    },
    removeItem(key) {
      calls.removeItem.push(key);
      if (fail.removeItem) throw new Error("removeItem failed");
      values.delete(key);
    }
  };
}

test("storage exports only the documented API and versioned key", () => {
  assert.deepEqual(Object.keys(storageApi).sort(), [
    "STORAGE_KEY",
    "createStateRepository",
    "decodeStoredState",
    "serializeAppState"
  ]);
  assert.equal(STORAGE_KEY, "sverigevistelseplanerare:state:v1");
});

test("mode initially reflects the best injected storage layer", () => {
  assert.equal(createStateRepository({
    localStorage: createFakeStorage(),
    sessionStorage: createFakeStorage()
  }).mode, "local");
  assert.equal(createStateRepository({
    sessionStorage: createFakeStorage()
  }).mode, "session");
  assert.equal(createStateRepository().mode, "memory");
  assert.equal(createStateRepository({
    localStorage: createFakeStorage({}, { getItem: true }),
    sessionStorage: createFakeStorage()
  }).mode, "session");
  assert.equal(createStateRepository({
    localStorage: createFakeStorage({}, { getItem: true }),
    sessionStorage: createFakeStorage({}, { getItem: true })
  }).mode, "memory");
});

test("decodeStoredState returns an empty successful result for a missing value", () => {
  assert.deepEqual(decodeStoredState(null), {
    ok: true,
    state: null,
    issue: null
  });
});

test("decodeStoredState accepts canonical v1 data and returns a normalized whitelist", () => {
  const input = {
    ...validState,
    profile: {
      ...validProfile,
      budgetDays: "90",
      ignoredProfileField: "profile-extra"
    },
    stays: [{ ...validStay, ignoredStayField: "stay-extra" }],
    ignoredStateField: "state-extra"
  };

  assert.deepEqual(decodeStoredState(JSON.stringify(input)), {
    ok: true,
    state: validState,
    issue: null
  });
});

test("decodeStoredState safely classifies malformed, invalid and unsupported data", async (context) => {
  const cases = [
    {
      name: "invalid JSON",
      raw: "{not-json",
      issue: {
        code: "invalid-json",
        message: "Sparad data kunde inte läsas. Rensa den för att börja om."
      }
    },
    {
      name: "invalid v1 state",
      raw: JSON.stringify({ version: 1, profile: null, stays: {} }),
      issue: {
        code: "invalid-state",
        message: "Sparad data har en ogiltig struktur. Rensa den för att börja om."
      }
    },
    {
      name: "version 0",
      raw: JSON.stringify({ version: 0, profile: null, stays: [] }),
      issue: {
        code: "unsupported-version",
        message: "Den sparade dataversionen stöds inte. Datan har inte skrivits över."
      }
    },
    {
      name: "version 2",
      raw: JSON.stringify({ version: 2, profile: null, stays: [] }),
      issue: {
        code: "unsupported-version",
        message: "Den sparade dataversionen stöds inte. Datan har inte skrivits över."
      }
    }
  ];

  for (const entry of cases) {
    await context.test(entry.name, () => {
      let result;
      assert.doesNotThrow(() => {
        result = decodeStoredState(entry.raw);
      });
      assert.deepEqual(result, {
        ok: false,
        state: null,
        issue: entry.issue
      });
    });
  }
});

test("serializeAppState persists only validated root, profile and stay fields", () => {
  const input = {
    ...validState,
    income: "root-income",
    passport: "root-passport",
    notes: "root-notes",
    profile: {
      ...validProfile,
      income: "profile-income",
      passport: "profile-passport",
      notes: "profile-notes"
    },
    stays: [{
      ...validStay,
      income: "stay-income",
      passport: "stay-passport",
      notes: "stay-notes"
    }]
  };

  const stored = JSON.parse(serializeAppState(input));

  assert.deepEqual(stored, validState);
  for (const field of ["income", "passport", "notes"]) {
    assert.equal(Object.hasOwn(stored, field), false);
    assert.equal(Object.hasOwn(stored.profile, field), false);
    assert.equal(Object.hasOwn(stored.stays[0], field), false);
  }
});

test("serializeAppState blocks demos and reports validation failures as TypeError", () => {
  assert.throws(
    () => serializeAppState({ ...validState, demo: true }),
    {
      name: "TypeError",
      message: "Demoexemplet får inte sparas."
    }
  );
  assert.throws(
    () => serializeAppState({ version: 1, profile: null, stays: {} }),
    {
      name: "TypeError",
      message: "Den sparade datan har en version eller struktur som inte stöds."
    }
  );
});

test("load uses local data when session data is missing", () => {
  const localStorage = createFakeStorage({
    [STORAGE_KEY]: JSON.stringify(validState)
  });
  const sessionStorage = createFakeStorage();
  const repository = createStateRepository({ localStorage, sessionStorage });

  assert.deepEqual(repository.load(), {
    state: validState,
    issue: null,
    mode: "local"
  });
  assert.equal(repository.mode, "local");
  assert.equal(sessionStorage.calls.getItem.length, 1);
});

test("load locks instead of choosing between different persistent states", () => {
  const localStorage = createFakeStorage({
    [STORAGE_KEY]: serializeAppState(validState)
  });
  const sessionState = { version: 1, profile: null, stays: [] };
  const sessionStorage = createFakeStorage({
    [STORAGE_KEY]: serializeAppState(sessionState)
  });
  const repository = createStateRepository({ localStorage, sessionStorage });

  assert.deepEqual(repository.load(), {
    state: null,
    issue: STORAGE_CONFLICT_ISSUE,
    mode: "local"
  });
  assert.notDeepEqual(repository.load().state, validState);
  assert.notDeepEqual(repository.load().state, sessionState);
  assert.deepEqual(repository.save(sessionState), {
    ok: false,
    issue: {
      code: "clear-required",
      message: "Rensa den inkompatibla datan innan en ny profil sparas."
    },
    mode: "local"
  });
  assert.deepEqual(localStorage.calls.setItem, []);
  assert.deepEqual(sessionStorage.calls.setItem, []);
});

test("load reads both layers and accepts identical persistent states as local", () => {
  const raw = serializeAppState(validState);
  const localStorage = createFakeStorage({ [STORAGE_KEY]: raw });
  const sessionStorage = createFakeStorage({ [STORAGE_KEY]: raw });
  const repository = createStateRepository({ localStorage, sessionStorage });

  assert.deepEqual(repository.load(), {
    state: validState,
    issue: null,
    mode: "local"
  });
  assert.equal(sessionStorage.calls.getItem.length, 1);
});

test("load detects different states when an unreadable stale local layer recovers", () => {
  const localStorage = createFakeStorage({
    [STORAGE_KEY]: serializeAppState(validState)
  }, { getItem: true });
  const sessionState = { version: 1, profile: null, stays: [] };
  const sessionStorage = createFakeStorage({
    [STORAGE_KEY]: serializeAppState(sessionState)
  });
  const repository = createStateRepository({ localStorage, sessionStorage });

  assert.deepEqual(repository.load(), {
    state: sessionState,
    issue: SESSION_ISSUE,
    mode: "session"
  });
  localStorage.fail.getItem = false;
  assert.deepEqual(repository.load(), {
    state: null,
    issue: STORAGE_CONFLICT_ISSUE,
    mode: "local"
  });
});

test("load falls back to session data when local data is missing or unreadable", async (context) => {
  for (const [name, localStorage] of [
    ["missing", createFakeStorage()],
    ["unreadable", createFakeStorage({}, { getItem: true })]
  ]) {
    await context.test(name, () => {
      const sessionStorage = createFakeStorage({
        [STORAGE_KEY]: JSON.stringify(validState)
      });
      const repository = createStateRepository({ localStorage, sessionStorage });

      assert.deepEqual(repository.load(), {
        state: validState,
        issue: SESSION_ISSUE,
        mode: "session"
      });
      assert.equal(repository.mode, "session");
    });
  }
});

test("load reports the warning for the best available empty fallback layer", () => {
  const localRepository = createStateRepository({
    localStorage: createFakeStorage()
  });
  const sessionRepository = createStateRepository({
    sessionStorage: createFakeStorage()
  });
  const memoryRepository = createStateRepository();

  assert.deepEqual(localRepository.load(), {
    state: null,
    issue: null,
    mode: "local"
  });
  assert.deepEqual(sessionRepository.load(), {
    state: null,
    issue: SESSION_ISSUE,
    mode: "session"
  });
  assert.deepEqual(memoryRepository.load(), {
    state: null,
    issue: MEMORY_ISSUE,
    mode: "memory"
  });
});

test("decode errors take priority over fallback warnings during load", () => {
  const sessionStorage = createFakeStorage({
    [STORAGE_KEY]: "{private-invalid-json"
  });
  const repository = createStateRepository({ sessionStorage });

  assert.deepEqual(repository.load(), {
    state: null,
    issue: {
      code: "invalid-json",
      message: "Sparad data kunde inte läsas. Rensa den för att börja om."
    },
    mode: "session"
  });
});

test("a decode issue stays locked despite later storage changes", () => {
  const invalidIssue = {
    code: "invalid-json",
    message: "Sparad data kunde inte läsas. Rensa den för att börja om."
  };
  const localStorage = createFakeStorage({
    [STORAGE_KEY]: "{private-invalid-json"
  });
  const repository = createStateRepository({ localStorage });

  assert.deepEqual(repository.load(), {
    state: null,
    issue: invalidIssue,
    mode: "local"
  });
  localStorage.values.set(STORAGE_KEY, serializeAppState(validState));
  const readsBeforeLockedLoad = localStorage.calls.getItem.length;

  assert.deepEqual(repository.load(), {
    state: null,
    issue: invalidIssue,
    mode: "local"
  });
  assert.equal(localStorage.calls.getItem.length, readsBeforeLockedLoad);
});

test("save preflights and preserves unsafe stored data before the first load", async (context) => {
  const nextState = { version: 1, profile: null, stays: [] };
  const cases = [
    {
      name: "unsupported local version",
      localRaw: JSON.stringify({ version: 2, profile: null, stays: [] })
    },
    {
      name: "invalid local JSON",
      localRaw: "{private-invalid-json"
    },
    {
      name: "invalid local schema",
      localRaw: JSON.stringify({ version: 1, profile: null, stays: {} })
    },
    {
      name: "unsupported session version",
      sessionRaw: JSON.stringify({ version: 2, profile: null, stays: [] })
    },
    {
      name: "invalid session JSON",
      sessionRaw: "{private-invalid-json"
    },
    {
      name: "different local and session states",
      localRaw: serializeAppState(validState),
      sessionRaw: serializeAppState(nextState)
    }
  ];

  for (const entry of cases) {
    await context.test(entry.name, () => {
      const localStorage = entry.localRaw === undefined
        ? null
        : createFakeStorage({ [STORAGE_KEY]: entry.localRaw });
      const sessionStorage = entry.sessionRaw === undefined
        ? null
        : createFakeStorage({ [STORAGE_KEY]: entry.sessionRaw });
      const repository = createStateRepository({ localStorage, sessionStorage });

      assert.deepEqual(repository.save(nextState), {
        ok: false,
        issue: {
          code: "clear-required",
          message: "Rensa den inkompatibla datan innan en ny profil sparas."
        },
        mode: localStorage === null ? "session" : "local"
      });
      if (localStorage !== null) {
        assert.deepEqual(localStorage.calls.setItem, []);
        assert.equal(localStorage.values.get(STORAGE_KEY), entry.localRaw);
      }
      if (sessionStorage !== null) {
        assert.deepEqual(sessionStorage.calls.setItem, []);
        assert.equal(sessionStorage.values.get(STORAGE_KEY), entry.sessionRaw);
      }
    });
  }
});

test("save preflights external storage changes on every call", () => {
  const localStorage = createFakeStorage();
  const repository = createStateRepository({ localStorage });
  const nextState = { version: 1, profile: null, stays: [] };

  assert.deepEqual(repository.save(validState), {
    ok: true,
    issue: null,
    mode: "local"
  });
  const writesBeforeUnsafeSave = localStorage.calls.setItem.length;
  const unsupportedRaw = JSON.stringify({ version: 2, profile: null, stays: [] });
  localStorage.values.set(STORAGE_KEY, unsupportedRaw);

  assert.deepEqual(repository.save(nextState), {
    ok: false,
    issue: {
      code: "clear-required",
      message: "Rensa den inkompatibla datan innan en ny profil sparas."
    },
    mode: "local"
  });
  assert.equal(localStorage.calls.setItem.length, writesBeforeUnsafeSave);
  assert.equal(localStorage.values.get(STORAGE_KEY), unsupportedRaw);
});

test("save preflights stored data before reading the candidate state", () => {
  const unsupportedRaw = JSON.stringify({ version: 2, profile: null, stays: [] });
  const localStorage = createFakeStorage({ [STORAGE_KEY]: unsupportedRaw });
  const state = {};
  let candidateReads = 0;
  Object.defineProperty(state, "demo", {
    get() {
      candidateReads += 1;
      throw new Error("candidate state must not be read");
    }
  });
  const repository = createStateRepository({ localStorage });

  assert.deepEqual(repository.save(state), {
    ok: false,
    issue: {
      code: "clear-required",
      message: "Rensa den inkompatibla datan innan en ny profil sparas."
    },
    mode: "local"
  });
  assert.equal(candidateReads, 0);
  assert.deepEqual(localStorage.calls.setItem, []);
  assert.equal(localStorage.values.get(STORAGE_KEY), unsupportedRaw);
});

test("save blocks an unreadable local layer before the first load", () => {
  const hiddenRaw = JSON.stringify({ version: 2, profile: null, stays: [] });
  const localStorage = createFakeStorage({
    [STORAGE_KEY]: hiddenRaw
  }, { getItem: true });
  const repository = createStateRepository({ localStorage });

  assert.deepEqual(repository.save(validState), {
    ok: false,
    issue: STORAGE_CONFLICT_ISSUE,
    mode: "local"
  });
  assert.deepEqual(localStorage.calls.setItem, []);
  assert.equal(localStorage.values.get(STORAGE_KEY), hiddenRaw);
});

test("save blocks an unreadable session layer for every local state", async (context) => {
  const hiddenRaw = JSON.stringify({ version: 2, profile: null, stays: [] });
  const cases = [
    { name: "empty local", localRaw: null },
    { name: "valid local", localRaw: serializeAppState(validState) }
  ];

  for (const entry of cases) {
    await context.test(entry.name, () => {
      const localStorage = createFakeStorage(entry.localRaw === null
        ? {}
        : { [STORAGE_KEY]: entry.localRaw });
      const sessionStorage = createFakeStorage({
        [STORAGE_KEY]: hiddenRaw
      }, { getItem: true });
      const repository = createStateRepository({ localStorage, sessionStorage });

      assert.deepEqual(repository.save({ version: 1, profile: null, stays: [] }), {
        ok: false,
        issue: STORAGE_CONFLICT_ISSUE,
        mode: "session"
      });
      assert.deepEqual(localStorage.calls.setItem, []);
      assert.deepEqual(sessionStorage.calls.setItem, []);
      assert.equal(localStorage.values.get(STORAGE_KEY) ?? null, entry.localRaw);
      assert.equal(sessionStorage.values.get(STORAGE_KEY), hiddenRaw);
    });
  }
});

test("save rechecks unreadable layers after a tolerated load", async (context) => {
  const hiddenRaw = JSON.stringify({ version: 2, profile: null, stays: [] });
  const nextState = { version: 1, profile: null, stays: [] };
  const cases = [
    {
      name: "unreadable local",
      localStorage: createFakeStorage({ [STORAGE_KEY]: hiddenRaw }, { getItem: true }),
      sessionStorage: createFakeStorage({
        [STORAGE_KEY]: serializeAppState(nextState)
      }),
      loaded: { state: nextState, issue: SESSION_ISSUE, mode: "session" },
      expectedMode: "local"
    },
    {
      name: "unreadable session",
      localStorage: createFakeStorage({
        [STORAGE_KEY]: serializeAppState(validState)
      }),
      sessionStorage: createFakeStorage({ [STORAGE_KEY]: hiddenRaw }, { getItem: true }),
      loaded: { state: validState, issue: null, mode: "local" },
      expectedMode: "session"
    }
  ];

  for (const entry of cases) {
    await context.test(entry.name, () => {
      const repository = createStateRepository({
        localStorage: entry.localStorage,
        sessionStorage: entry.sessionStorage
      });

      assert.deepEqual(repository.load(), entry.loaded);
      assert.deepEqual(repository.save(nextState), {
        ok: false,
        issue: STORAGE_CONFLICT_ISSUE,
        mode: entry.expectedMode
      });
      assert.deepEqual(entry.localStorage.calls.setItem, []);
      assert.deepEqual(entry.sessionStorage.calls.setItem, []);
      assert.equal(entry.localStorage.values.get(STORAGE_KEY),
        entry.expectedMode === "local" ? hiddenRaw : serializeAppState(validState));
      assert.equal(entry.sessionStorage.values.get(STORAGE_KEY),
        entry.expectedMode === "session" ? hiddenRaw : serializeAppState(nextState));
    });
  }
});

test("unsupported saved data remains unchanged and locks writes until clear", () => {
  const incompatibleRaw = JSON.stringify({
    version: 2,
    profile: { passport: "PRIVATE-PASSPORT" },
    stays: []
  });
  const localStorage = createFakeStorage({ [STORAGE_KEY]: incompatibleRaw });
  const repository = createStateRepository({ localStorage });

  assert.deepEqual(repository.load(), {
    state: null,
    issue: {
      code: "unsupported-version",
      message: "Den sparade dataversionen stöds inte. Datan har inte skrivits över."
    },
    mode: "local"
  });
  assert.equal(localStorage.values.get(STORAGE_KEY), incompatibleRaw);
  assert.deepEqual(repository.save(validState), {
    ok: false,
    issue: {
      code: "clear-required",
      message: "Rensa den inkompatibla datan innan en ny profil sparas."
    },
    mode: "local"
  });
  assert.deepEqual(localStorage.calls.setItem, []);
  assert.equal(localStorage.values.get(STORAGE_KEY), incompatibleRaw);

  assert.deepEqual(repository.clear(), {
    ok: true,
    issue: null,
    mode: "local"
  });
  assert.equal(localStorage.values.has(STORAGE_KEY), false);
  assert.deepEqual(repository.save(validState), {
    ok: true,
    issue: null,
    mode: "local"
  });
  assert.equal(localStorage.calls.setItem.length, 1);
});

test("a successful session save keeps its warning on subsequent loads", () => {
  const localStorage = createFakeStorage({}, { setItem: true });
  const sessionStorage = createFakeStorage();
  const repository = createStateRepository({ localStorage, sessionStorage });

  assert.deepEqual(repository.save(validState), {
    ok: true,
    issue: SESSION_ISSUE,
    mode: "session"
  });
  assert.equal(localStorage.calls.setItem.length, 1);
  assert.equal(sessionStorage.values.get(STORAGE_KEY), serializeAppState(validState));
  assert.equal(repository.mode, "session");
  assert.deepEqual(repository.load(), {
    state: validState,
    issue: SESSION_ISSUE,
    mode: "session"
  });
});

test("session fallback removes and verifies stale local data before writing", () => {
  const localStorage = createFakeStorage({
    [STORAGE_KEY]: serializeAppState(validState)
  }, { setItem: true });
  const sessionStorage = createFakeStorage();
  const repository = createStateRepository({ localStorage, sessionStorage });
  const nextState = { version: 1, profile: null, stays: [] };

  assert.deepEqual(repository.load(), {
    state: validState,
    issue: null,
    mode: "local"
  });
  assert.deepEqual(repository.save(nextState), {
    ok: true,
    issue: SESSION_ISSUE,
    mode: "session"
  });
  assert.deepEqual(localStorage.calls.removeItem, [STORAGE_KEY]);
  assert.equal(localStorage.values.has(STORAGE_KEY), false);
  assert.equal(sessionStorage.values.get(STORAGE_KEY), serializeAppState(nextState));
  assert.deepEqual(repository.load(), {
    state: nextState,
    issue: SESSION_ISSUE,
    mode: "session"
  });
});

test("session fallback is blocked when injected local storage cannot be read", () => {
  const localStorage = createFakeStorage({
    [STORAGE_KEY]: serializeAppState(validState)
  }, { getItem: true, setItem: true });
  const sessionStorage = createFakeStorage();
  const repository = createStateRepository({ localStorage, sessionStorage });

  assert.deepEqual(repository.save(validState), {
    ok: false,
    issue: STORAGE_CONFLICT_ISSUE,
    mode: "local"
  });
  assert.deepEqual(localStorage.calls.removeItem, []);
  assert.deepEqual(sessionStorage.calls.setItem, []);
  assert.deepEqual(repository.save(validState), {
    ok: false,
    issue: {
      code: "clear-required",
      message: "Rensa den inkompatibla datan innan en ny profil sparas."
    },
    mode: "local"
  });
});

test("session fallback is allowed when local storage is absent", () => {
  const sessionStorage = createFakeStorage();
  const repository = createStateRepository({ sessionStorage });

  assert.deepEqual(repository.save(validState), {
    ok: true,
    issue: SESSION_ISSUE,
    mode: "session"
  });
  assert.equal(sessionStorage.values.get(STORAGE_KEY), serializeAppState(validState));
});

test("unsafe local cleanup blocks session writes and locks the repository", async (context) => {
  const cases = [
    {
      name: "remove throws",
      configure(storage) {
        storage.fail.removeItem = true;
      }
    },
    {
      name: "removed value remains",
      configure(storage) {
        storage.removeItem = (key) => {
          storage.calls.removeItem.push(key);
        };
      }
    },
    {
      name: "verification read throws",
      configure(storage) {
        storage.removeItem = (key) => {
          storage.calls.removeItem.push(key);
          storage.values.delete(key);
          storage.fail.getItem = true;
        };
      }
    }
  ];

  for (const entry of cases) {
    await context.test(entry.name, () => {
      const localStorage = createFakeStorage({
        [STORAGE_KEY]: serializeAppState(validState)
      }, { setItem: true });
      const sessionStorage = createFakeStorage();
      const repository = createStateRepository({ localStorage, sessionStorage });
      const nextState = { version: 1, profile: null, stays: [] };
      repository.load();
      entry.configure(localStorage);

      assert.deepEqual(repository.save(nextState), {
        ok: false,
        issue: {
          code: "storage-conflict",
          message: "Äldre lokal data kunde inte ersättas. Rensa appdatan och försök igen."
        },
        mode: "local"
      });
      assert.deepEqual(sessionStorage.calls.setItem, []);
      assert.equal(localStorage.calls.setItem.length, 1);
      assert.deepEqual(repository.save(nextState), {
        ok: false,
        issue: {
          code: "clear-required",
          message: "Rensa den inkompatibla datan innan en ny profil sparas."
        },
        mode: "local"
      });
      assert.equal(localStorage.calls.setItem.length, 1);
      assert.deepEqual(sessionStorage.calls.setItem, []);
    });
  }
});

test("a memory save remains loadable and keeps its warning", () => {
  const localStorage = createFakeStorage({}, { setItem: true });
  const sessionStorage = createFakeStorage({}, { setItem: true });
  const repository = createStateRepository({ localStorage, sessionStorage });

  assert.deepEqual(repository.save(validState), {
    ok: true,
    issue: MEMORY_ISSUE,
    mode: "memory"
  });
  assert.equal(repository.mode, "memory");
  assert.deepEqual(repository.load(), {
    state: validState,
    issue: MEMORY_ISSUE,
    mode: "memory"
  });
});

test("persistent saves discard older in-memory state", async (context) => {
  const nextState = { version: 1, profile: null, stays: [] };
  const cases = [
    {
      name: "direct local write",
      target: "local",
      expected: { ok: true, issue: null, mode: "local" },
      configure(localStorage) {
        localStorage.fail.setItem = false;
      }
    },
    {
      name: "verified local write after setItem throws",
      target: "local",
      expected: { ok: true, issue: null, mode: "local" },
      configure(localStorage) {
        localStorage.setItem = (key, value) => {
          localStorage.calls.setItem.push([key, value]);
          localStorage.values.set(key, value);
          throw new Error("setItem failed after write");
        };
      }
    },
    {
      name: "direct session write",
      target: "session",
      expected: { ok: true, issue: SESSION_ISSUE, mode: "session" },
      configure(_localStorage, sessionStorage) {
        sessionStorage.fail.setItem = false;
      }
    },
    {
      name: "verified session write after setItem throws",
      target: "session",
      expected: { ok: true, issue: SESSION_ISSUE, mode: "session" },
      configure(_localStorage, sessionStorage) {
        sessionStorage.setItem = (key, value) => {
          sessionStorage.calls.setItem.push([key, value]);
          sessionStorage.values.set(key, value);
          throw new Error("setItem failed after write");
        };
      }
    }
  ];

  for (const entry of cases) {
    await context.test(entry.name, () => {
      const localStorage = createFakeStorage({}, { setItem: true });
      const sessionStorage = createFakeStorage({}, { setItem: true });
      const repository = createStateRepository({ localStorage, sessionStorage });

      assert.deepEqual(repository.save(validState), {
        ok: true,
        issue: MEMORY_ISSUE,
        mode: "memory"
      });
      entry.configure(localStorage, sessionStorage);
      assert.deepEqual(repository.save(nextState), entry.expected);

      const targetStorage = entry.target === "local" ? localStorage : sessionStorage;
      targetStorage.values.delete(STORAGE_KEY);
      const loaded = repository.load();
      assert.deepEqual(loaded, {
        state: null,
        issue: null,
        mode: "local"
      });
      assert.notDeepEqual(loaded.state, validState);
    });
  }
});

test("memory fallback removes and verifies stale session data before saving", () => {
  const localStorage = createFakeStorage({}, { setItem: true });
  const sessionStorage = createFakeStorage({
    [STORAGE_KEY]: serializeAppState(validState)
  }, { setItem: true });
  const repository = createStateRepository({ localStorage, sessionStorage });
  const nextState = { version: 1, profile: null, stays: [] };
  repository.load();

  assert.deepEqual(repository.save(nextState), {
    ok: true,
    issue: MEMORY_ISSUE,
    mode: "memory"
  });
  assert.deepEqual(sessionStorage.calls.removeItem, [STORAGE_KEY]);
  assert.equal(sessionStorage.values.has(STORAGE_KEY), false);
  assert.deepEqual(repository.load(), {
    state: nextState,
    issue: MEMORY_ISSUE,
    mode: "memory"
  });
});

test("unsafe session cleanup blocks memory and locks the repository", async (context) => {
  const cases = [
    {
      name: "remove throws",
      configure(storage) {
        storage.fail.removeItem = true;
      },
      restore(storage) {
        storage.fail.removeItem = false;
      }
    },
    {
      name: "removed value remains",
      configure(storage) {
        storage.removeItem = (key) => {
          storage.calls.removeItem.push(key);
        };
      },
      restore() {}
    },
    {
      name: "verification read throws",
      configure(storage) {
        storage.removeItem = (key) => {
          storage.calls.removeItem.push(key);
          storage.values.delete(key);
          storage.fail.getItem = true;
        };
      },
      restore(storage) {
        storage.fail.getItem = false;
      }
    }
  ];

  for (const entry of cases) {
    await context.test(entry.name, () => {
      const localStorage = createFakeStorage({}, { setItem: true });
      const sessionStorage = createFakeStorage({
        [STORAGE_KEY]: serializeAppState(validState)
      }, { setItem: true });
      const repository = createStateRepository({ localStorage, sessionStorage });
      const nextState = { version: 1, profile: null, stays: [] };
      repository.load();
      entry.configure(sessionStorage);

      assert.deepEqual(repository.save(nextState), {
        ok: false,
        issue: STORAGE_CONFLICT_ISSUE,
        mode: "session"
      });
      assert.equal(sessionStorage.calls.setItem.length, 1);
      entry.restore(sessionStorage);
      sessionStorage.values.delete(STORAGE_KEY);
      assert.deepEqual(repository.load(), {
        state: null,
        issue: STORAGE_CONFLICT_ISSUE,
        mode: "session"
      });
      assert.deepEqual(repository.save(nextState), {
        ok: false,
        issue: {
          code: "clear-required",
          message: "Rensa den inkompatibla datan innan en ny profil sparas."
        },
        mode: "session"
      });
    });
  }
});

test("unreadable injected session storage blocks memory fallback", () => {
  const localStorage = createFakeStorage({}, { setItem: true });
  const sessionStorage = createFakeStorage({
    [STORAGE_KEY]: serializeAppState(validState)
  }, { getItem: true, setItem: true });
  const repository = createStateRepository({ localStorage, sessionStorage });

  assert.deepEqual(repository.save(validState), {
    ok: false,
    issue: STORAGE_CONFLICT_ISSUE,
    mode: "session"
  });
  assert.deepEqual(sessionStorage.calls.removeItem, []);
  sessionStorage.fail.getItem = false;
  sessionStorage.values.delete(STORAGE_KEY);
  assert.deepEqual(repository.load(), {
    state: null,
    issue: STORAGE_CONFLICT_ISSUE,
    mode: "session"
  });
});

test("memory fallback is allowed when session storage is absent", () => {
  const localStorage = createFakeStorage({}, { setItem: true });
  const repository = createStateRepository({ localStorage });

  assert.deepEqual(repository.save(validState), {
    ok: true,
    issue: MEMORY_ISSUE,
    mode: "memory"
  });
  assert.deepEqual(repository.load(), {
    state: validState,
    issue: MEMORY_ISSUE,
    mode: "memory"
  });
});

test("a later successful local save promotes a fallback repository to local", () => {
  const localStorage = createFakeStorage({}, { setItem: true });
  const sessionStorage = createFakeStorage({}, { setItem: true });
  const repository = createStateRepository({ localStorage, sessionStorage });
  repository.save(validState);
  localStorage.fail.setItem = false;
  const nextState = { version: 1, profile: null, stays: [] };

  assert.deepEqual(repository.save(nextState), {
    ok: true,
    issue: null,
    mode: "local"
  });
  assert.equal(repository.mode, "local");
  assert.deepEqual(repository.load(), {
    state: nextState,
    issue: null,
    mode: "local"
  });
});

test("a successful local save removes stale session data", () => {
  const localStorage = createFakeStorage({}, { setItem: true });
  const sessionStorage = createFakeStorage();
  const repository = createStateRepository({ localStorage, sessionStorage });
  repository.save(validState);
  localStorage.fail.setItem = false;
  const nextState = { version: 1, profile: null, stays: [] };

  assert.deepEqual(repository.save(nextState), {
    ok: true,
    issue: null,
    mode: "local"
  });
  assert.deepEqual(sessionStorage.calls.removeItem, [STORAGE_KEY]);
  assert.equal(sessionStorage.values.has(STORAGE_KEY), false);

  localStorage.fail.getItem = true;
  const loaded = repository.load();
  assert.deepEqual(loaded, {
    state: null,
    issue: SESSION_ISSUE,
    mode: "session"
  });
  assert.notDeepEqual(loaded.state, validState);
});

test("a local save overwrites stale session data when session removal fails", () => {
  const localStorage = createFakeStorage({}, { setItem: true });
  const sessionStorage = createFakeStorage({}, { removeItem: true });
  const repository = createStateRepository({ localStorage, sessionStorage });
  repository.save(validState);
  localStorage.fail.setItem = false;
  const nextState = { version: 1, profile: null, stays: [] };

  assert.deepEqual(repository.save(nextState), {
    ok: true,
    issue: null,
    mode: "local"
  });
  assert.deepEqual(sessionStorage.calls.removeItem, [STORAGE_KEY]);
  assert.equal(sessionStorage.calls.setItem.length, 2);
  assert.equal(sessionStorage.values.get(STORAGE_KEY), serializeAppState(nextState));

  localStorage.fail.getItem = true;
  assert.deepEqual(repository.load(), {
    state: nextState,
    issue: SESSION_ISSUE,
    mode: "session"
  });
});

test("a local save overwrites stale session data after a silent remove no-op", () => {
  const localStorage = createFakeStorage();
  const sessionStorage = createFakeStorage({
    [STORAGE_KEY]: serializeAppState(validState)
  });
  sessionStorage.removeItem = (key) => {
    sessionStorage.calls.removeItem.push(key);
  };
  const repository = createStateRepository({ localStorage, sessionStorage });
  const nextState = { version: 1, profile: null, stays: [] };

  assert.deepEqual(repository.save(nextState), {
    ok: true,
    issue: null,
    mode: "local"
  });
  assert.deepEqual(sessionStorage.calls.removeItem, [STORAGE_KEY]);
  assert.equal(sessionStorage.calls.setItem.length, 1);
  assert.equal(sessionStorage.values.get(STORAGE_KEY), serializeAppState(nextState));
  assert.deepEqual(repository.load(), {
    state: nextState,
    issue: null,
    mode: "local"
  });
});

test("unverified session neutralization locks after a local save", async (context) => {
  const cases = [
    {
      name: "remove and overwrite throw",
      configure(storage) {
        storage.fail.removeItem = true;
        storage.fail.setItem = true;
      }
    },
    {
      name: "overwrite silently leaves stale data",
      configure(storage) {
        storage.fail.removeItem = true;
        storage.setItem = (key, value) => {
          storage.calls.setItem.push([key, value]);
        };
      }
    },
    {
      name: "verification reads throw",
      configure(storage) {
        storage.removeItem = (key) => {
          storage.calls.removeItem.push(key);
          storage.values.delete(key);
          storage.fail.getItem = true;
        };
      }
    }
  ];

  for (const entry of cases) {
    await context.test(entry.name, () => {
      const localStorage = createFakeStorage();
      const sessionStorage = createFakeStorage({
        [STORAGE_KEY]: serializeAppState(validState)
      });
      entry.configure(sessionStorage);
      const repository = createStateRepository({ localStorage, sessionStorage });
      const nextState = { version: 1, profile: null, stays: [] };

      assert.deepEqual(repository.save(nextState), {
        ok: false,
        issue: STORAGE_CONFLICT_ISSUE,
        mode: "local"
      });
      assert.equal(localStorage.values.get(STORAGE_KEY), serializeAppState(nextState));
      assert.notDeepEqual(repository.load().state, validState);
      assert.deepEqual(repository.save(nextState), {
        ok: false,
        issue: {
          code: "clear-required",
          message: "Rensa den inkompatibla datan innan en ny profil sparas."
        },
        mode: "local"
      });
      assert.equal(localStorage.calls.setItem.length, 1);
    });
  }
});

test("a storage conflict cannot load stale session data before clear", () => {
  const localStorage = createFakeStorage();
  const sessionStorage = createFakeStorage({
    [STORAGE_KEY]: serializeAppState(validState)
  }, { removeItem: true, setItem: true });
  const repository = createStateRepository({ localStorage, sessionStorage });
  const nextState = { version: 1, profile: null, stays: [] };

  assert.deepEqual(repository.save(nextState), {
    ok: false,
    issue: STORAGE_CONFLICT_ISSUE,
    mode: "local"
  });
  localStorage.fail.getItem = true;
  const localReadsBeforeLockedLoad = localStorage.calls.getItem.length;
  const sessionReadsBeforeLockedLoad = sessionStorage.calls.getItem.length;

  assert.deepEqual(repository.load(), {
    state: null,
    issue: STORAGE_CONFLICT_ISSUE,
    mode: "local"
  });
  assert.equal(localStorage.calls.getItem.length, localReadsBeforeLockedLoad);
  assert.equal(sessionStorage.calls.getItem.length, sessionReadsBeforeLockedLoad);

  localStorage.fail.getItem = false;
  sessionStorage.fail.removeItem = false;
  sessionStorage.fail.setItem = false;
  assert.deepEqual(repository.clear(), {
    ok: true,
    issue: null,
    mode: "local"
  });
  assert.deepEqual(repository.load(), {
    state: null,
    issue: null,
    mode: "local"
  });
  assert.deepEqual(repository.save(nextState), {
    ok: true,
    issue: null,
    mode: "local"
  });
});

test("save rejects invalid state without attempting storage writes", () => {
  const localStorage = createFakeStorage();
  const sessionStorage = createFakeStorage();
  const repository = createStateRepository({ localStorage, sessionStorage });

  assert.deepEqual(repository.save({
    version: 1,
    profile: { ...validProfile, budgetDays: 0, notes: "PRIVATE-NOTE" },
    stays: []
  }), {
    ok: false,
    issue: {
      code: "invalid-state",
      message: "Den sparade profilen är ogiltig."
    },
    mode: "local"
  });
  assert.deepEqual(localStorage.calls.setItem, []);
  assert.deepEqual(sessionStorage.calls.setItem, []);
});

test("save replaces unexpected serialization exceptions with a safe issue", () => {
  const privateMessage = "PRIVATE-NOTE 2033-04-05";
  const state = {};
  Object.defineProperty(state, "demo", {
    get() {
      throw new Error(privateMessage);
    }
  });
  const localStorage = createFakeStorage();
  const repository = createStateRepository({ localStorage });

  const result = repository.save(state);

  assert.deepEqual(result, {
    ok: false,
    issue: {
      code: "invalid-state",
      message: "Den sparade datan har en version eller struktur som inte stöds."
    },
    mode: "local"
  });
  assert.equal(result.issue.message.includes(privateMessage), false);
  assert.deepEqual(localStorage.calls.setItem, []);
});

test("clear stays locked when local data remains and succeeds only after retry", () => {
  const staleRaw = serializeAppState(validState);
  const currentRaw = serializeAppState({ version: 1, profile: null, stays: [] });
  const localStorage = createFakeStorage({
    [STORAGE_KEY]: staleRaw,
    "foreign:key": "keep-local"
  }, { removeItem: true });
  const sessionStorage = createFakeStorage({
    [STORAGE_KEY]: currentRaw,
    "other:key": "keep-session"
  });
  const repository = createStateRepository({ localStorage, sessionStorage });

  assert.deepEqual(repository.clear(), {
    ok: false,
    issue: CLEAR_FAILED_ISSUE,
    mode: "local"
  });
  assert.deepEqual(localStorage.calls.removeItem, [STORAGE_KEY]);
  assert.deepEqual(sessionStorage.calls.removeItem, [STORAGE_KEY]);
  assert.equal(localStorage.values.get(STORAGE_KEY), staleRaw);
  assert.equal(sessionStorage.values.has(STORAGE_KEY), false);
  assert.equal(localStorage.values.get("foreign:key"), "keep-local");
  assert.equal(sessionStorage.values.get("other:key"), "keep-session");

  const localReadsBeforeLockedLoad = localStorage.calls.getItem.length;
  const sessionReadsBeforeLockedLoad = sessionStorage.calls.getItem.length;
  assert.deepEqual(repository.load(), {
    state: null,
    issue: CLEAR_FAILED_ISSUE,
    mode: "local"
  });
  assert.equal(localStorage.calls.getItem.length, localReadsBeforeLockedLoad);
  assert.equal(sessionStorage.calls.getItem.length, sessionReadsBeforeLockedLoad);

  localStorage.fail.removeItem = false;
  assert.deepEqual(repository.clear(), {
    ok: true,
    issue: null,
    mode: "local"
  });
  assert.deepEqual(localStorage.calls.removeItem, [STORAGE_KEY, STORAGE_KEY]);
  assert.deepEqual(sessionStorage.calls.removeItem, [STORAGE_KEY, STORAGE_KEY]);
  assert.deepEqual(repository.load(), {
    state: null,
    issue: null,
    mode: "local"
  });
  assert.deepEqual(repository.save({ version: 1, profile: null, stays: [] }), {
    ok: true,
    issue: null,
    mode: "local"
  });
});

test("clear accepts a remove exception when read-back verifies deletion", () => {
  const localStorage = createFakeStorage({ [STORAGE_KEY]: "local-state" });
  localStorage.removeItem = (key) => {
    localStorage.calls.removeItem.push(key);
    localStorage.values.delete(key);
    throw new Error("removeItem failed after deletion");
  };
  const repository = createStateRepository({ localStorage });

  assert.deepEqual(repository.clear(), {
    ok: true,
    issue: null,
    mode: "local"
  });
  assert.equal(localStorage.values.has(STORAGE_KEY), false);
});

test("clear stays locked when removal cannot be verified", () => {
  const localStorage = createFakeStorage({ [STORAGE_KEY]: "local-state" });
  localStorage.removeItem = (key) => {
    localStorage.calls.removeItem.push(key);
    localStorage.values.delete(key);
    localStorage.fail.getItem = true;
  };
  const repository = createStateRepository({ localStorage });

  assert.deepEqual(repository.clear(), {
    ok: false,
    issue: CLEAR_FAILED_ISSUE,
    mode: "memory"
  });
  assert.deepEqual(repository.load(), {
    state: null,
    issue: CLEAR_FAILED_ISSUE,
    mode: "memory"
  });

  localStorage.fail.getItem = false;
  localStorage.removeItem = (key) => {
    localStorage.calls.removeItem.push(key);
    localStorage.values.delete(key);
  };
  assert.deepEqual(repository.clear(), {
    ok: true,
    issue: null,
    mode: "local"
  });
});

test("clear verifies a failed session removal after a memory fallback", () => {
  const sessionStorage = createFakeStorage({}, { setItem: true });
  const repository = createStateRepository({ sessionStorage });
  const nextState = { version: 1, profile: null, stays: [] };

  assert.deepEqual(repository.save(validState), {
    ok: true,
    issue: MEMORY_ISSUE,
    mode: "memory"
  });
  const currentRaw = serializeAppState(nextState);
  sessionStorage.values.set(STORAGE_KEY, currentRaw);
  sessionStorage.fail.removeItem = true;

  assert.deepEqual(repository.clear(), {
    ok: false,
    issue: CLEAR_FAILED_ISSUE,
    mode: "session"
  });
  assert.equal(sessionStorage.values.get(STORAGE_KEY), currentRaw);
  assert.deepEqual(repository.load(), {
    state: null,
    issue: CLEAR_FAILED_ISSUE,
    mode: "session"
  });

  sessionStorage.fail.removeItem = false;
  sessionStorage.fail.setItem = false;
  assert.deepEqual(repository.clear(), {
    ok: true,
    issue: null,
    mode: "session"
  });
  assert.deepEqual(repository.load(), {
    state: null,
    issue: SESSION_ISSUE,
    mode: "session"
  });
  assert.deepEqual(repository.save(nextState), {
    ok: true,
    issue: SESSION_ISSUE,
    mode: "session"
  });
});

test("clear stays locked when session read-back is unavailable", () => {
  const sessionStorage = createFakeStorage({ [STORAGE_KEY]: "session-state" });
  sessionStorage.removeItem = (key) => {
    sessionStorage.calls.removeItem.push(key);
    sessionStorage.values.delete(key);
    sessionStorage.fail.getItem = true;
  };
  const repository = createStateRepository({ sessionStorage });

  assert.deepEqual(repository.clear(), {
    ok: false,
    issue: CLEAR_FAILED_ISSUE,
    mode: "memory"
  });
  assert.deepEqual(repository.load(), {
    state: null,
    issue: CLEAR_FAILED_ISSUE,
    mode: "memory"
  });
});

test("storage failures never call console methods", () => {
  const consoleMethods = ["debug", "error", "info", "log", "warn"];
  const originals = new Map();
  const calls = [];
  for (const method of consoleMethods) {
    originals.set(method, console[method]);
    console[method] = (...args) => calls.push([method, ...args]);
  }

  try {
    const localStorage = createFakeStorage({}, {
      getItem: true,
      setItem: true,
      removeItem: true
    });
    const sessionStorage = createFakeStorage({}, {
      getItem: true,
      setItem: true,
      removeItem: true
    });
    const repository = createStateRepository({ localStorage, sessionStorage });
    repository.load();
    repository.save(validState);
    repository.clear();
  } finally {
    for (const method of consoleMethods) {
      console[method] = originals.get(method);
    }
  }

  assert.deepEqual(calls, []);
});

test("issues never expose serialized personal values or date fixtures", () => {
  const privateValues = [
    "PRIVATE-PASSPORT",
    "PRIVATE-NOTE",
    validProfile.departureDate,
    validProfile.periodStart,
    validStay.arrivalDate,
    validStay.createdAt
  ];
  const issues = [
    decodeStoredState("{PRIVATE-NOTE").issue,
    decodeStoredState(JSON.stringify({
      version: 2,
      profile: { passport: "PRIVATE-PASSPORT" },
      stays: []
    })).issue,
    decodeStoredState(JSON.stringify({
      ...validState,
      profile: { ...validProfile, budgetDays: 0, notes: "PRIVATE-NOTE" }
    })).issue,
    createStateRepository().save({
      version: 1,
      profile: { ...validProfile, budgetDays: 0, passport: "PRIVATE-PASSPORT" },
      stays: []
    }).issue
  ];

  for (const currentIssue of issues) {
    assert.deepEqual(Object.keys(currentIssue).sort(), ["code", "message"]);
    for (const privateValue of privateValues) {
      assert.equal(currentIssue.message.includes(privateValue), false);
    }
  }
});
