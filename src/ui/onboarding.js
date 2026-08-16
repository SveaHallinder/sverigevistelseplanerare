import { CHECKLIST_CONTENT } from "../legal-content.js";
import { CHECKLIST_KEYS } from "../domain/validation.js";

const HTML_ENTITIES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
}

function errorFor(errors, key) {
  const message = errors?.[key];
  return message
    ? '<p class="field-error" id="' + escapeHtml(key) + '-error">' +
      escapeHtml(message) + "</p>"
    : "";
}

function errorAttributes(errors, key) {
  return errors?.[key]
    ? ' aria-invalid="true" aria-describedby="' + escapeHtml(key) + '-error"'
    : "";
}

function triState(name, value = "unanswered", errors = {}) {
  const attributes = errorAttributes(errors, name);
  return ["yes", "no", "unanswered"].map((option) => {
    const label = option === "yes"
      ? "Ja"
      : option === "no" ? "Nej" : "Vill inte svara nu";
    const checked = value === option ? " checked" : "";
    return '<label class="radio-option"><input type="radio" name="' + escapeHtml(name) +
      '" value="' + option + '"' + checked + attributes + "> " + label + "</label>";
  }).join("");
}

function triStateFieldset({ name, legend, value, errors }) {
  return '<fieldset class="question-group"' + errorAttributes(errors, name) + ">" +
    "<legend>" + escapeHtml(legend) + "</legend>" +
    '<div class="radio-options">' + triState(name, value, errors) + "</div>" +
    errorFor(errors, name) + "</fieldset>";
}

export function renderOnboarding({
  profile = null,
  fieldErrors = {},
  storageIssue = null,
  editing = false,
  defaultYear
}) {
  const defaults = profile ?? {
    departureDate: "",
    budgetDays: 90,
    periodStart: defaultYear + "-01-01",
    periodEnd: defaultYear + "-12-31",
    swedishCitizen: "unanswered",
    livedInSwedenTenYears: "unanswered",
    connectionChecklist: {}
  };
  const errors = Object.values(fieldErrors);
  const errorSummary = errors.length > 0
    ? '<div class="error-summary" role="alert"><h2>Kontrollera uppgifterna</h2><p>' +
      errors.map(escapeHtml).join(" ") + "</p></div>"
    : "";
  const storageBanner = storageIssue
    ? '<p class="storage-warning" role="status">' +
      escapeHtml(storageIssue.message) + "</p>"
    : "";
  const checklist = CHECKLIST_KEYS.map((key) => triStateFieldset({
    name: "connectionChecklist." + key,
    legend: CHECKLIST_CONTENT[key].label,
    value: defaults.connectionChecklist?.[key],
    errors: fieldErrors
  })).join("");

  return '<section class="onboarding" aria-labelledby="onboarding-title">' +
    '<header class="onboarding-header"><p class="eyebrow">Sverigevistelseplaneraren</p>' +
    '<h1 id="onboarding-title">' +
    (editing ? "Ändra din plan" : "Planera Sverigedagar med tydliga antaganden") +
    "</h1>" +
    '<p class="disclaimer">Planeringsverktyg, inte juridisk rådgivning. ' +
    "Ett grönt budgetläge är inte ett juridiskt besked.</p></header>" +
    '<div class="onboarding-body">' + storageBanner + errorSummary +
    '<form data-form="profile" novalidate>' +
    '<div class="field"><label for="departureDate">Utflyttningsdatum</label>' +
    '<input id="departureDate" name="departureDate" type="date" value="' +
    escapeHtml(defaults.departureDate) + '"' +
    errorAttributes(fieldErrors, "departureDate") + ">" +
    errorFor(fieldErrors, "departureDate") + "</div>" +
    '<div class="field"><label for="budgetDays">Personlig dagbudget</label>' +
    '<span class="field-hint" id="budgetDays-hint">Ditt eget planeringstak, inte en laggräns.</span>' +
    '<input id="budgetDays" name="budgetDays" type="number" min="1" step="1" value="' +
    escapeHtml(defaults.budgetDays) + '"' + errorAttributes(fieldErrors, "budgetDays") + ">" +
    errorFor(fieldErrors, "budgetDays") + "</div>" +
    '<div class="date-pair"><div class="field"><label for="periodStart">Period från</label>' +
    '<input id="periodStart" name="periodStart" type="date" value="' +
    escapeHtml(defaults.periodStart) +
    '"' + errorAttributes(fieldErrors, "periodStart") + ">" +
    errorFor(fieldErrors, "periodStart") + "</div>" +
    '<div class="field"><label for="periodEnd">Period till</label>' +
    '<input id="periodEnd" name="periodEnd" type="date" value="' +
    escapeHtml(defaults.periodEnd) +
    '"' + errorAttributes(fieldErrors, "periodEnd") + ">" +
    errorFor(fieldErrors, "periodEnd") + "</div></div>" +
    '<details class="legal-questions"><summary>Frivilliga frågor för juridiska observationer</summary>' +
    '<p class="details-intro">Du kan lämna frågorna obesvarade och komplettera senare.</p>' +
    triStateFieldset({
      name: "swedishCitizen",
      legend: "Är du svensk medborgare?",
      value: defaults.swedishCitizen,
      errors: fieldErrors
    }) +
    triStateFieldset({
      name: "livedInSwedenTenYears",
      legend: "Har du bott eller stadigvarande vistats i Sverige i minst tio år?",
      value: defaults.livedInSwedenTenYears,
      errors: fieldErrors
    }) + checklist + "</details>" +
    '<div class="form-actions"><button class="primary-button" type="submit">' +
    (editing ? "Spara ändringar" : "Skapa min plan") + "</button>" +
    (editing
      ? '<button class="secondary-button" type="button" data-action="cancel-edit-profile">Avbryt</button>'
      : "") +
    "</div></form>" +
    (editing
      ? ""
      : '<button class="text-button" type="button" data-action="show-demo">Visa syntetiskt demoexempel</button>') +
    "</div></section>";
}

export function readProfileForm(form) {
  const data = new FormData(form);
  return {
    departureDate: data.get("departureDate"),
    budgetDays: Number(data.get("budgetDays")),
    periodStart: data.get("periodStart"),
    periodEnd: data.get("periodEnd"),
    swedishCitizen: data.get("swedishCitizen") ?? "unanswered",
    livedInSwedenTenYears: data.get("livedInSwedenTenYears") ?? "unanswered",
    connectionChecklist: Object.fromEntries(CHECKLIST_KEYS.map((key) => [
      key,
      data.get("connectionChecklist." + key) ?? "unanswered"
    ]))
  };
}
