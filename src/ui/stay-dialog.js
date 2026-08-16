const HTML_ENTITIES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};
const returnFocusByDialog = new WeakMap();

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
}

function errorId(key) {
  return "stay-" + key + "-error";
}

function errorAttributes(errors, key) {
  return errors?.[key]
    ? ' aria-invalid="true" aria-describedby="' + errorId(key) + '"'
    : "";
}

function errorFor(errors, key) {
  return errors?.[key]
    ? '<p class="field-error" id="' + errorId(key) + '">' +
      escapeHtml(errors[key]) + "</p>"
    : "";
}

function dayWord(count) {
  return Math.abs(count) === 1 ? "dag" : "dagar";
}

function renderPreview(preview) {
  if (!preview) {
    return "";
  }

  const boundary = preview.candidateFirstExceededDate
    ? "<p>Första dagen i vistelsen över budget är " +
      escapeHtml(preview.candidateFirstExceededDate) + ".</p>"
    : preview.candidateLastWithinBudgetDate
      ? "<p>Vistelsen ryms inom budget till och med " +
        escapeHtml(preview.candidateLastWithinBudgetDate) + ".</p>"
      : "<p>Vistelsen har inga datum inom budgetperioden.</p>";
  const remaining = preview.remaining >= 0
    ? escapeHtml(preview.remaining) + " " + dayWord(preview.remaining) +
      " kvar i din personliga budget."
    : escapeHtml(Math.abs(preview.remaining)) +
      " " + dayWord(preview.remaining) + " över din personliga budget.";

  return '<aside class="stay-preview" aria-labelledby="stay-preview-title">' +
    '<h3 id="stay-preview-title">Efter vistelsen</h3><p><strong>' +
    escapeHtml(preview.uniqueDays) + " / " + escapeHtml(preview.budgetDays) +
    " registrerade dagar</strong></p><p>" + remaining + "</p>" + boundary +
    "</aside>";
}

function renderDelete(model) {
  if (model.mode !== "edit") {
    return "";
  }
  if (!model.deleteRequested) {
    return '<button class="danger-text" type="button" data-action="request-delete">' +
      "Ta bort vistelsen</button>";
  }
  return '<div class="delete-confirmation" role="alert"><p>' +
    "Vill du ta bort vistelsen permanent?</p>" +
    '<button class="danger-button" type="button" data-action="confirm-delete">' +
    "Ja, ta bort</button>" +
    '<button class="secondary-button" type="button" data-action="cancel-delete">' +
    "Avbryt</button></div>";
}

export function renderStayDialog(model) {
  const values = model.values ?? {};
  const errors = model.fieldErrors ?? {};
  const title = model.mode === "edit" ? "Redigera vistelse" : "Lägg till vistelse";
  const message = model.message
    ? '<div class="error-summary" role="alert"><p>' +
      escapeHtml(model.message) + "</p></div>"
    : "";
  const actualChecked = values.status === "actual" ? " checked" : "";
  const plannedChecked = values.status === "planned" ? " checked" : "";

  return '<section class="stay-dialog"><header><h2 id="stay-dialog-title">' +
    title + '</h2><button class="dialog-close" type="button" ' +
    'data-action="cancel-stay" aria-label="Stäng">&times;</button></header>' +
    message + '<form data-form="stay" novalidate>' +
    '<div class="date-pair"><div class="field"><label for="stay-arrivalDate">' +
    'Ankomstdatum</label><input id="stay-arrivalDate" name="arrivalDate" type="date" value="' +
    escapeHtml(values.arrivalDate ?? "") + '"' +
    errorAttributes(errors, "arrivalDate") + ">" + errorFor(errors, "arrivalDate") +
    '</div><div class="field"><label for="stay-departureDate">Avresedatum</label>' +
    '<input id="stay-departureDate" name="departureDate" type="date" value="' +
    escapeHtml(values.departureDate ?? "") + '"' +
    errorAttributes(errors, "departureDate") + ">" + errorFor(errors, "departureDate") +
    "</div></div>" +
    '<p class="field-hint">Ankomst- och avresedag räknas inkluderande.</p>' +
    '<fieldset class="question-group"' + errorAttributes(errors, "status") +
    '><legend>Status</legend><div class="radio-options">' +
    '<label class="radio-option"><input type="radio" name="status" value="actual"' +
    actualChecked + "> Faktisk</label>" +
    '<label class="radio-option"><input type="radio" name="status" value="planned"' +
    plannedChecked + "> Planerad</label></div>" + errorFor(errors, "status") +
    "</fieldset>" + renderPreview(model.preview) +
    '<div class="form-actions"><button class="primary-button" type="submit">' +
    (model.mode === "edit" ? "Spara ändringar" : "Lägg till vistelse") +
    '</button><button class="secondary-button" type="button" data-action="cancel-stay">' +
    "Avbryt</button></div>" + renderDelete(model) + "</form></section>";
}

export function openStayDialog(dialog, model, returnFocusElement) {
  if (!dialog) {
    return;
  }
  returnFocusByDialog.set(dialog, returnFocusElement ?? null);
  dialog.innerHTML = renderStayDialog(model);
  if (!dialog.open && typeof dialog.showModal === "function") {
    dialog.showModal();
  }
  dialog.querySelector?.('[name="arrivalDate"]')?.focus?.();
}

export function closeStayDialog(dialog) {
  if (!dialog) {
    return;
  }
  if (dialog.open && typeof dialog.close === "function") {
    dialog.close();
  }
  const returnFocusElement = returnFocusByDialog.get(dialog);
  returnFocusByDialog.delete(dialog);
  if (returnFocusElement?.isConnected !== false) {
    returnFocusElement?.focus?.();
  }
}

export function readStayForm(form) {
  const data = new FormData(form);
  return {
    arrivalDate: data.get("arrivalDate"),
    departureDate: data.get("departureDate"),
    status: data.get("status")
  };
}
