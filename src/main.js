import { createAppController } from "./controller.js";
import { evaluatePlannedStay } from "./domain/budget.js";
import { addDays, isIsoDate, todayLocalIso } from "./domain/dates.js";
import { createStateRepository } from "./storage.js";
import { buildCockpitModel, renderCockpit } from "./ui/cockpit.js";
import { readProfileForm, renderOnboarding } from "./ui/onboarding.js";
import {
  closeStayDialog,
  openStayDialog,
  readStayForm
} from "./ui/stay-dialog.js";

function safeWindowValue(windowRef, key) {
  try {
    return windowRef?.[key] ?? null;
  } catch {
    return null;
  }
}

function createIdFactory(windowRef) {
  let fallbackSequence = 0;
  return () => {
    try {
      const randomUUID = windowRef?.crypto?.randomUUID;
      if (typeof randomUUID === "function") {
        return randomUUID.call(windowRef.crypto);
      }
    } catch {
      // Den lokala fallbacken nedan kräver ingen browserbehörighet.
    }
    fallbackSequence += 1;
    return "stay-" + Date.now().toString(36) + "-" + fallbackSequence;
  };
}

function yearFromDate(date) {
  return Number(date.slice(0, 4));
}

export function createBrowserApp(options = {}) {
  const documentRef = options.documentRef ?? globalThis.document;
  const windowRef = options.windowRef ?? globalThis.window ?? {};
  const app = documentRef?.querySelector?.("#app");
  const dialog = documentRef?.querySelector?.("#stay-dialog");
  const liveRegion = documentRef?.querySelector?.("#live-region");
  if (!app || !dialog || !liveRegion) {
    return null;
  }

  const today = options.today ?? todayLocalIso();
  const now = options.now ?? (() => new Date().toISOString());
  const makeId = options.makeId ?? createIdFactory(windowRef);
  const repository = options.repository ?? createStateRepository({
    localStorage: safeWindowValue(windowRef, "localStorage"),
    sessionStorage: safeWindowValue(windowRef, "sessionStorage")
  });
  let published = null;
  let viewYear = yearFromDate(today);
  let focusedDate = today;
  let currentDialog = null;
  let clearRequested = false;

  function announce(message) {
    if (message) {
      liveRegion.textContent = message;
    }
  }

  function renderPublished({ profile = undefined, fieldErrors = {} } = {}) {
    if (!published) {
      return;
    }
    if (published.state?.profile && !published.editingProfile) {
      const model = buildCockpitModel(published.state, {
        today: published.today,
        year: viewYear,
        focusedDate,
        storageIssue: published.storageIssue,
        clearRequested,
        demo: published.demo
      });
      focusedDate = model.focusedDate;
      app.innerHTML = renderCockpit(model);
      return;
    }

    app.innerHTML = renderOnboarding({
      profile: profile ?? (published.editingProfile ? published.state?.profile : null),
      fieldErrors,
      storageIssue: published.storageIssue,
      editing: published.editingProfile,
      clearRequested,
      defaultYear: today.slice(0, 4)
    });
  }

  function receivePublished(nextPublished) {
    const hadProfile = Boolean(published?.state?.profile);
    published = nextPublished;
    if (!hadProfile && published.state?.profile) {
      viewYear = yearFromDate(published.state.profile.periodStart);
      focusedDate = yearFromDate(today) === viewYear
        ? today
        : published.state.profile.periodStart;
    }
    renderPublished();
  }

  const controller = createAppController({
    repository,
    render: receivePublished,
    makeId,
    now,
    today
  });

  function dialogPreview(values, id) {
    const state = controller.getSnapshot().state;
    if (!state?.profile
      || !isIsoDate(values.arrivalDate)
      || !isIsoDate(values.departureDate)
      || values.departureDate < values.arrivalDate) {
      return null;
    }
    const preview = evaluatePlannedStay(
      state.profile,
      state.stays,
      values,
      id ? { excludeStayId: id } : {}
    );
    return { ...preview, budgetDays: state.profile.budgetDays };
  }

  function currentDialogModel() {
    return {
      mode: currentDialog.id ? "edit" : "create",
      values: currentDialog.values,
      fieldErrors: currentDialog.fieldErrors,
      message: currentDialog.message,
      preview: dialogPreview(currentDialog.values, currentDialog.id),
      deleteRequested: currentDialog.deleteRequested
    };
  }

  function renderCurrentDialog(focusName = null) {
    if (!currentDialog) {
      return;
    }
    openStayDialog(dialog, currentDialogModel(), currentDialog.returnFocusElement);
    if (["arrivalDate", "departureDate", "status"].includes(focusName)) {
      dialog.querySelector?.('[name="' + focusName + '"]')?.focus?.();
    }
  }

  function openStay({ id = null, values, returnFocusElement }) {
    currentDialog = {
      id,
      values,
      fieldErrors: {},
      message: "",
      deleteRequested: false,
      returnFocusElement
    };
    renderCurrentDialog();
  }

  function closeCurrentDialog() {
    const needsFallbackFocus = currentDialog?.returnFocusElement?.isConnected === false;
    closeStayDialog(dialog);
    currentDialog = null;
    if (needsFallbackFocus) {
      const fallback = app.querySelector?.('[data-action="add-stay"]') ?? app;
      fallback.focus?.();
    }
  }

  function openNewStay(date, returnFocusElement) {
    openStay({
      values: {
        arrivalDate: date,
        departureDate: date,
        status: "planned"
      },
      returnFocusElement
    });
  }

  function openExistingStay(id, returnFocusElement) {
    const current = controller.getSnapshot().state?.stays.find((stay) => stay.id === id);
    if (!current) {
      announce("Vistelsen kunde inte hittas.");
      return;
    }
    openStay({
      id,
      values: {
        arrivalDate: current.arrivalDate,
        departureDate: current.departureDate,
        status: current.status
      },
      returnFocusElement
    });
  }

  function focusCalendar(date) {
    app.querySelector?.('[data-date="' + date + '"]')?.focus?.();
  }

  function changeYear(offset) {
    const nextYear = Math.max(1, Math.min(9999, viewYear + offset));
    viewYear = nextYear;
    focusedDate = String(nextYear).padStart(4, "0") + "-01-01";
    renderPublished();
    focusCalendar(focusedDate);
  }

  app.addEventListener("submit", (event) => {
    if (!event.target?.matches?.('[data-form="profile"]')) {
      return;
    }
    event.preventDefault();
    const input = readProfileForm(event.target);
    const saved = controller.saveProfile(input);
    if (!saved.ok) {
      renderPublished({ profile: input, fieldErrors: saved.fieldErrors });
      announce(saved.message);
      return;
    }
    announce(saved.message);
  });

  app.addEventListener("click", (event) => {
    const target = event.target?.closest?.("[data-action]");
    if (!target) {
      return;
    }
    const action = target.dataset.action;
    if (action === "previous-year" || action === "next-year") {
      changeYear(action === "previous-year" ? -1 : 1);
    } else if (action === "add-stay") {
      openNewStay(today, target);
    } else if (action === "select-date") {
      focusedDate = target.dataset.date;
      viewYear = yearFromDate(focusedDate);
      openNewStay(focusedDate, target);
    } else if (action === "edit-stay") {
      openExistingStay(target.dataset.stayId, target);
    } else if (action === "confirm-actual") {
      const result = controller.confirmPastPlanned(target.dataset.stayId);
      announce(result.message);
    } else if (action === "show-demo") {
      announce(controller.showDemo().message);
    } else if (action === "exit-demo") {
      announce(controller.exitDemo().message);
    } else if (action === "edit-profile") {
      controller.beginEditProfile();
    } else if (action === "cancel-edit-profile") {
      controller.cancelEditProfile();
    } else if (action === "request-clear") {
      clearRequested = true;
      renderPublished();
      app.querySelector?.('[data-action="confirm-clear"]')?.focus?.();
    } else if (action === "cancel-clear") {
      clearRequested = false;
      renderPublished();
      app.querySelector?.('[data-action="request-clear"]')?.focus?.();
    } else if (action === "confirm-clear") {
      const cleared = controller.clearAll({ confirmed: true });
      clearRequested = !cleared.ok;
      renderPublished();
      announce(cleared.message);
      if (!cleared.ok) {
        app.querySelector?.('[data-action="confirm-clear"]')?.focus?.();
      }
    }
  });

  app.addEventListener("keydown", (event) => {
    const target = event.target?.closest?.("[data-date]");
    if (!target || target.dataset.action === "demo-date") {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      focusedDate = target.dataset.date;
      viewYear = yearFromDate(focusedDate);
      openNewStay(focusedDate, target);
      return;
    }
    const offsets = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7
    };
    const offset = offsets[event.key];
    if (!offset) {
      return;
    }
    event.preventDefault();
    const nextDate = addDays(target.dataset.date, offset);
    focusedDate = nextDate;
    viewYear = yearFromDate(nextDate);
    renderPublished();
    focusCalendar(nextDate);
  });

  dialog.addEventListener("submit", (event) => {
    if (!event.target?.matches?.('[data-form="stay"]') || !currentDialog) {
      return;
    }
    event.preventDefault();
    const input = readStayForm(event.target);
    currentDialog.values = input;
    const saved = controller.saveStay(input, currentDialog.id);
    if (!saved.ok) {
      currentDialog.fieldErrors = saved.fieldErrors;
      currentDialog.message = saved.message;
      renderCurrentDialog();
      return;
    }
    closeCurrentDialog();
    announce(saved.message);
  });

  dialog.addEventListener("cancel", (event) => {
    if (!currentDialog) {
      return;
    }
    event.preventDefault();
    closeCurrentDialog();
  });

  dialog.addEventListener("change", (event) => {
    const form = event.target?.closest?.('[data-form="stay"]');
    if (!form || !currentDialog) {
      return;
    }
    currentDialog.values = readStayForm(form);
    currentDialog.fieldErrors = {};
    currentDialog.message = "";
    renderCurrentDialog(event.target.name);
  });

  dialog.addEventListener("click", (event) => {
    const target = event.target?.closest?.("[data-action]");
    if (!target || !currentDialog) {
      return;
    }
    const action = target.dataset.action;
    if (action === "cancel-stay") {
      closeCurrentDialog();
    } else if (action === "request-delete") {
      currentDialog.deleteRequested = true;
      renderCurrentDialog();
    } else if (action === "cancel-delete") {
      currentDialog.deleteRequested = false;
      renderCurrentDialog();
    } else if (action === "confirm-delete") {
      const removed = controller.removeStay(currentDialog.id);
      if (!removed.ok) {
        currentDialog.message = removed.message;
        renderCurrentDialog();
        return;
      }
      closeCurrentDialog();
      announce(removed.message);
    }
  });

  controller.init();
  return { controller };
}

if (typeof document !== "undefined") {
  createBrowserApp();
}
