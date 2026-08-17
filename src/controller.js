import {
  addStay,
  createEmptyState,
  removeStay as removeStayFromState,
  setProfile,
  updateStay
} from "./domain/state.js";
import {
  createBackupJson,
  createStayCsv as encodeStayCsv,
  parseBackupJson
} from "./data-transfer.js";
import { createDemoState } from "./demo-state.js";

const BLOCKING_STORAGE_ISSUES = new Set([
  "unsupported-version",
  "invalid-json",
  "invalid-state",
  "storage-conflict",
  "clear-required",
  "clear-failed"
]);

export function createAppController({
  repository,
  render,
  makeId,
  now,
  today
}) {
  let state = null;
  let storageIssue = null;
  let demoState = null;
  let editingProfile = false;
  let restoreCandidate = null;
  let restorePreview = null;

  function publish() {
    render({
      state: demoState ?? state,
      storageIssue,
      demo: demoState !== null,
      editingProfile,
      today,
      ...(restorePreview ? { restorePreview } : {})
    });
  }

  function result(ok, message = "", fieldErrors = {}, extra = {}) {
    return { ok, message, fieldErrors, ...extra };
  }

  function blockedByDemo() {
    return demoState === null
      ? null
      : result(false, "Avsluta demoexemplet innan du ändrar din plan.");
  }

  function blockedByStorage() {
    return BLOCKING_STORAGE_ISSUES.has(storageIssue?.code)
      ? result(false, storageIssue.message)
      : null;
  }

  function blockedByRestore() {
    return restoreCandidate === null
      ? null
      : result(false, "Bekräfta eller avbryt återställningen först.");
  }

  function persist(nextState, message, { onSuccess } = {}) {
    const blocked = blockedByStorage();
    if (blocked) return blocked;
    const saved = repository.save(nextState);
    storageIssue = saved.issue;
    if (!saved.ok) {
      publish();
      return result(false, saved.issue?.message ?? "Datan kunde inte sparas.");
    }
    state = nextState;
    demoState = null;
    editingProfile = false;
    onSuccess?.();
    publish();
    return result(true, message);
  }

  function init() {
    const loaded = repository.load();
    state = loaded.state;
    storageIssue = loaded.issue;
    publish();
    return result(true);
  }

  function saveProfile(input) {
    const blocked = blockedByRestore() ?? blockedByDemo();
    if (blocked) return blocked;
    const base = state ?? createEmptyState();
    const changed = setProfile(base, input);
    return changed.ok
      ? persist(changed.value, "Din plan har sparats.")
      : result(false, changed.message, changed.fieldErrors);
  }

  function saveStay(input, id = null) {
    const blocked = blockedByRestore() ?? blockedByDemo();
    if (blocked) return blocked;
    if (!state?.profile) {
      return result(false, "Skapa en profil innan du lägger till vistelser.");
    }
    const metadata = { id: id ?? makeId(), timestamp: now() };
    const changed = id
      ? updateStay(state, id, input, metadata)
      : addStay(state, input, metadata);
    return changed.ok
      ? persist(
          changed.value,
          id ? "Vistelsen har uppdaterats." : "Vistelsen har lagts till."
        )
      : result(false, changed.message, changed.fieldErrors);
  }

  function removeStay(id) {
    const blocked = blockedByRestore() ?? blockedByDemo();
    if (blocked) return blocked;
    if (!state) {
      return result(false, "Vistelsen kunde inte hittas.");
    }
    const changed = removeStayFromState(state, id);
    return changed.ok
      ? persist(changed.value, "Vistelsen har tagits bort.")
      : result(false, changed.message, changed.fieldErrors);
  }

  function confirmPastPlanned(id) {
    const blocked = blockedByRestore() ?? blockedByDemo();
    if (blocked) return blocked;
    const current = state?.stays.find((stay) => stay.id === id);
    if (!current) {
      return result(false, "Vistelsen kunde inte hittas.");
    }
    if (current.status !== "planned" || current.departureDate >= today) {
      return result(
        false,
        "Endast en passerad planerad vistelse kan markeras som genomförd."
      );
    }
    return saveStay({
      arrivalDate: current.arrivalDate,
      departureDate: current.departureDate,
      status: "actual"
    }, id);
  }

  function showDemo() {
    const blocked = blockedByRestore();
    if (blocked) return blocked;
    if (state?.profile) {
      return result(false, "Demo kan bara öppnas innan en egen plan har skapats.");
    }
    demoState = createDemoState(today);
    publish();
    return result(true);
  }

  function exitDemo() {
    demoState = null;
    publish();
    return result(true);
  }

  function beginEditProfile() {
    const blocked = blockedByRestore() ?? blockedByDemo();
    if (blocked) return blocked;
    editingProfile = true;
    publish();
    return result(true);
  }

  function cancelEditProfile() {
    const blocked = blockedByRestore();
    if (blocked) return blocked;
    editingProfile = false;
    publish();
    return result(true);
  }

  function clearAll({ confirmed = false } = {}) {
    const blocked = blockedByRestore() ?? blockedByDemo();
    if (blocked) return blocked;
    if (!confirmed) {
      return result(false, "Bekräfta att profilen och alla vistelser ska tas bort.");
    }
    const cleared = repository.clear();
    if (!cleared.ok) {
      storageIssue = cleared.issue ?? {
        code: "clear-failed",
        message: "Datan kunde inte rensas."
      };
      publish();
      return result(false, cleared.issue?.message ?? "Datan kunde inte rensas.");
    }
    state = null;
    demoState = null;
    storageIssue = null;
    editingProfile = false;
    restoreCandidate = null;
    restorePreview = null;
    publish();
    return result(true, "All lokal appdata har rensats.");
  }

  function createDownload(codec, filename, mimeType, emptyMessage = null) {
    const blocked = blockedByDemo();
    if (blocked) return blocked;
    if (!state?.profile) {
      return result(false, "Skapa en profil innan du exporterar data.");
    }
    if (emptyMessage && state.stays.length === 0) {
      return result(false, emptyMessage);
    }
    const encoded = codec(state);
    return encoded.ok
      ? result(true, "Filen är klar.", {}, {
          download: { filename, mimeType, content: encoded.value }
        })
      : result(false, encoded.message);
  }

  function createBackupDownload() {
    return createDownload(
      createBackupJson,
      "sverigevistelseplaneraren-backup-" + today + ".json",
      "application/json;charset=utf-8"
    );
  }

  function createCsvDownload() {
    return createDownload(
      encodeStayCsv,
      "sverigevistelseplaneraren-vistelser-" + today + ".csv",
      "text/csv;charset=utf-8",
      "Det finns inga vistelser att exportera."
    );
  }

  function previewRestore({ raw, fileName }) {
    const blocked = blockedByDemo() ?? blockedByStorage();
    if (blocked) return blocked;
    const parsed = parseBackupJson(raw);
    if (!parsed.ok) {
      return result(false, parsed.message);
    }
    restoreCandidate = parsed.value;
    restorePreview = {
      fileName: String(fileName || "backup.json").slice(0, 255),
      hasProfile: parsed.value.profile !== null,
      stayCount: parsed.value.stays.length
    };
    publish();
    return result(true, "Backupfilen är kontrollerad.");
  }

  function cancelRestore() {
    restoreCandidate = null;
    restorePreview = null;
    publish();
    return result(true, "Återställningen har avbrutits.");
  }

  function confirmRestore({ confirmed = false } = {}) {
    const blocked = blockedByDemo();
    if (blocked) return blocked;
    if (restoreCandidate === null || !confirmed) {
      return result(false, "Bekräfta att den aktuella datan ska ersättas.");
    }
    const restored = persist(restoreCandidate, "Backupen har återställts.", {
      onSuccess() {
        restoreCandidate = null;
        restorePreview = null;
      }
    });
    if (!restored.ok && storageIssue?.code === "storage-conflict") {
      return result(
        false,
        "Återställningen kunde inte slutföras. Backupen kan ha skrivits "
          + "delvis. Avbryt återställningen och ladda om sidan. Om "
          + "lagringsvarningen kvarstår, rensa appdatan och välj backupfilen igen."
      );
    }
    return restored;
  }

  function getSnapshot() {
    return {
      state,
      storageIssue,
      demo: demoState !== null,
      editingProfile,
      today
    };
  }

  return {
    init,
    saveProfile,
    saveStay,
    removeStay,
    confirmPastPlanned,
    showDemo,
    exitDemo,
    beginEditProfile,
    cancelEditProfile,
    clearAll,
    createBackupDownload,
    createCsvDownload,
    previewRestore,
    cancelRestore,
    confirmRestore,
    getSnapshot
  };
}
