import {
  addStay,
  createEmptyState,
  removeStay as removeStayFromState,
  setProfile,
  updateStay
} from "./domain/state.js";
import { createDemoState } from "./demo-state.js";

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

  function publish() {
    render({
      state: demoState ?? state,
      storageIssue,
      demo: demoState !== null,
      editingProfile,
      today
    });
  }

  function result(ok, message = "", fieldErrors = {}) {
    return { ok, message, fieldErrors };
  }

  function blockedByDemo() {
    return demoState === null
      ? null
      : result(false, "Avsluta demoexemplet innan du ändrar din plan.");
  }

  function persist(nextState, message) {
    const saved = repository.save(nextState);
    storageIssue = saved.issue;
    if (!saved.ok) {
      publish();
      return result(false, saved.issue?.message ?? "Datan kunde inte sparas.");
    }
    state = nextState;
    demoState = null;
    editingProfile = false;
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
    const blocked = blockedByDemo();
    if (blocked) return blocked;
    const base = state ?? createEmptyState();
    const changed = setProfile(base, input);
    return changed.ok
      ? persist(changed.value, "Din plan har sparats.")
      : result(false, changed.message, changed.fieldErrors);
  }

  function saveStay(input, id = null) {
    const blocked = blockedByDemo();
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
    const blocked = blockedByDemo();
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
    const blocked = blockedByDemo();
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
    const blocked = blockedByDemo();
    if (blocked) return blocked;
    editingProfile = true;
    publish();
    return result(true);
  }

  function cancelEditProfile() {
    editingProfile = false;
    publish();
    return result(true);
  }

  function clearAll({ confirmed = false } = {}) {
    const blocked = blockedByDemo();
    if (blocked) return blocked;
    if (!confirmed) {
      return result(false, "Bekräfta att profilen och alla vistelser ska tas bort.");
    }
    const cleared = repository.clear();
    if (!cleared.ok) {
      return result(false, cleared.issue?.message ?? "Datan kunde inte rensas.");
    }
    state = null;
    demoState = null;
    storageIssue = null;
    editingProfile = false;
    publish();
    return result(true, "All lokal appdata har rensats.");
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
    getSnapshot
  };
}
