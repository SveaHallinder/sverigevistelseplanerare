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

test("load uses local data before session data", () => {
  const localStorage = createFakeStorage({
    [STORAGE_KEY]: JSON.stringify(validState)
  });
  const sessionState = { version: 1, profile: null, stays: [] };
  const sessionStorage = createFakeStorage({
    [STORAGE_KEY]: JSON.stringify(sessionState)
  });
  const repository = createStateRepository({ localStorage, sessionStorage });

  assert.deepEqual(repository.load(), {
    state: validState,
    issue: null,
    mode: "local"
  });
  assert.equal(repository.mode, "local");
  assert.deepEqual(sessionStorage.calls.getItem, []);
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

test("session fallback is allowed when local storage cannot be read", () => {
  const localStorage = createFakeStorage({
    [STORAGE_KEY]: serializeAppState(validState)
  }, { getItem: true, setItem: true });
  const sessionStorage = createFakeStorage();
  const repository = createStateRepository({ localStorage, sessionStorage });

  assert.deepEqual(repository.save(validState), {
    ok: true,
    issue: SESSION_ISSUE,
    mode: "session"
  });
  assert.deepEqual(localStorage.calls.removeItem, []);
  assert.equal(sessionStorage.values.get(STORAGE_KEY), serializeAppState(validState));
  assert.deepEqual(repository.load(), {
    state: validState,
    issue: SESSION_ISSUE,
    mode: "session"
  });
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

test("clear removes only the namespaced key and continues after a remove failure", () => {
  const localStorage = createFakeStorage({
    [STORAGE_KEY]: "local-state",
    "foreign:key": "keep-local"
  }, { removeItem: true });
  const sessionStorage = createFakeStorage({
    [STORAGE_KEY]: "session-state",
    "other:key": "keep-session"
  });
  const repository = createStateRepository({ localStorage, sessionStorage });

  assert.doesNotThrow(() => {
    assert.deepEqual(repository.clear(), {
      ok: true,
      issue: null,
      mode: "local"
    });
  });
  assert.deepEqual(localStorage.calls.removeItem, [STORAGE_KEY]);
  assert.deepEqual(sessionStorage.calls.removeItem, [STORAGE_KEY]);
  assert.equal(localStorage.values.get(STORAGE_KEY), "local-state");
  assert.equal(sessionStorage.values.has(STORAGE_KEY), false);
  assert.equal(localStorage.values.get("foreign:key"), "keep-local");
  assert.equal(sessionStorage.values.get("other:key"), "keep-session");
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
