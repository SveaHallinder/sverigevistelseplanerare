import { calculateBudget } from "../domain/budget.js";
import { buildBudgetExplanation } from "../domain/budget-explanation.js";
import { addDays, isIsoDate } from "../domain/dates.js";
import { buildObservations } from "../domain/observations.js";
import { getPastPlannedStays } from "../domain/stays.js";
import { LEGAL_SOURCES } from "../legal-content.js";
import { renderBudgetExplanation } from "./budget-explanation.js";
import { renderObservations } from "./observations.js";

const MONTHS = [
  "Januari", "Februari", "Mars", "April", "Maj", "Juni",
  "Juli", "Augusti", "September", "Oktober", "November", "December"
];
const WEEKDAYS = [
  { short: "M", label: "Måndag" },
  { short: "T", label: "Tisdag" },
  { short: "O", label: "Onsdag" },
  { short: "T", label: "Torsdag" },
  { short: "F", label: "Fredag" },
  { short: "L", label: "Lördag" },
  { short: "S", label: "Söndag" }
];
const HTML_ENTITIES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};
const FALLBACK_WARNING = "Data kan försvinna när sidan stängs";
const BLOCKING_STORAGE_ISSUES = new Set([
  "unsupported-version",
  "invalid-json",
  "invalid-state",
  "storage-conflict",
  "clear-required",
  "clear-failed"
]);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
}

function iso(year, month, day) {
  return String(year).padStart(4, "0") + "-" +
    String(month).padStart(2, "0") + "-" +
    String(day).padStart(2, "0");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "long",
    timeZone: "UTC"
  }).format(new Date(value + "T00:00:00Z"));
}

function dateBelongsToYear(date, year) {
  return isIsoDate(date) && date.slice(0, 4) === String(year).padStart(4, "0");
}

function dayWord(count) {
  return count === 1 ? "dag" : "dagar";
}

function presentStorageIssue(storageIssue) {
  if (!storageIssue) {
    return null;
  }
  const preciseMessage = String(storageIssue.message ?? "Lagringen kunde inte användas.");
  const isFallback = storageIssue.code === "session-fallback"
    || storageIssue.code === "memory-fallback";
  return {
    blocking: BLOCKING_STORAGE_ISSUES.has(storageIssue.code),
    message: isFallback && !preciseMessage.includes(FALLBACK_WARNING)
      ? FALLBACK_WARNING + ". " + preciseMessage
      : preciseMessage
  };
}

function mergeDates(dates) {
  const intervals = [];
  for (const date of dates) {
    const current = intervals.at(-1);
    if (current && date === addDays(current.departureDate, 1)) {
      current.departureDate = date;
    } else {
      intervals.push({ arrivalDate: date, departureDate: date });
    }
  }
  return intervals;
}

function renderDateInterval(interval) {
  const start = escapeHtml(formatDate(interval.arrivalDate));
  const end = escapeHtml(formatDate(interval.departureDate));
  return '<span class="edge-range">' +
    (interval.arrivalDate === interval.departureDate ? start : start + "–" + end) +
    "</span>";
}

export function buildCockpitModel(state, {
  today,
  year = Number(state.profile.periodStart.slice(0, 4)),
  focusedDate = null,
  storageIssue = null,
  clearRequested = false,
  demo = false
}) {
  const budget = calculateBudget(state.profile, state.stays);
  const firstDateOfYear = iso(year, 1, 1);
  const requestedFocus = focusedDate ?? today;
  const focus = dateBelongsToYear(requestedFocus, year)
    ? requestedFocus
    : firstDateOfYear;

  return {
    profile: state.profile,
    stays: [...state.stays].sort((left, right) =>
      left.arrivalDate.localeCompare(right.arrivalDate)),
    budget,
    explanation: buildBudgetExplanation(state.profile, state.stays),
    observations: buildObservations(state.profile, state.stays),
    pastPlanned: getPastPlannedStays(state.stays, today),
    statusByDate: budget.statusByDate,
    year,
    focusedDate: focus,
    storageIssue,
    clearRequested,
    demo
  };
}

function renderMonth(model, month) {
  const days = new Date(Date.UTC(model.year, month, 0)).getUTCDate();
  const firstWeekday =
    (new Date(Date.UTC(model.year, month - 1, 1)).getUTCDay() + 6) % 7;
  const cells = Array.from(
    { length: firstWeekday },
    () => '<td class="calendar-blank" aria-hidden="true"></td>'
  );

  for (let day = 1; day <= days; day += 1) {
    const date = iso(model.year, month, day);
    const registeredStatus = model.statusByDate[date];
    const status = registeredStatus === "actual" || registeredStatus === "planned"
      ? registeredStatus
      : "unregistered";
    const statusLabel = status === "actual"
      ? "faktisk vistelse"
      : status === "planned" ? "planerad vistelse" : "inte registrerad";
    const tabindex = date === model.focusedDate ? "0" : "-1";
    const action = model.demo ? "demo-date" : "select-date";
    const disabled = model.demo ? ' aria-disabled="true"' : "";

    cells.push('<td><button class="calendar-day calendar-day--' + status +
      '" type="button" data-action="' + action + '" data-date="' +
      escapeHtml(date) + '" data-status="' + status + '" tabindex="' +
      tabindex + '" aria-label="' + escapeHtml(formatDate(date)) + ", " +
      statusLabel + '"' + disabled + ">" +
      '<span class="calendar-day__number" aria-hidden="true">' + day + "</span>" +
      '<span class="calendar-day__marker" aria-hidden="true"></span>' +
      "</button></td>");
  }

  while (cells.length % 7 !== 0) {
    cells.push('<td class="calendar-blank" aria-hidden="true"></td>');
  }

  const rows = [];
  for (let index = 0; index < cells.length; index += 7) {
    rows.push("<tr>" + cells.slice(index, index + 7).join("") + "</tr>");
  }

  return '<section class="month-card" aria-labelledby="month-' + month + '">' +
    '<h3 id="month-' + month + '">' + MONTHS[month - 1] + "</h3>" +
    '<table aria-labelledby="month-' + month + '"><thead><tr>' +
    WEEKDAYS.map((weekday) =>
      '<th scope="col"><span aria-hidden="true">' + weekday.short +
      '</span><span class="sr-only">' + weekday.label +
      "</span></th>"
    ).join("") + '</tr></thead><tbody>' + rows.join("") + "</tbody></table></section>";
}

export function renderYearCalendar(model) {
  return '<div class="year-calendar" aria-label="Årskalender ' +
    escapeHtml(model.year) + '">' +
    Array.from({ length: 12 }, (_, index) => renderMonth(model, index + 1)).join("") +
    "</div>";
}

function renderEmptyStayList(model) {
  return '<div class="empty-state"><h2>Inga Sverigedagar registrerade</h2>' +
    "<p>Omarkerade dagar är inte registrerade och bevisar inte utlandsvistelse.</p>" +
    (model.demo
      ? ""
      : '<button class="primary-button" type="button" data-action="add-stay">' +
        "Lägg till första vistelsen</button>") +
    "</div>";
}

function renderStayList(model) {
  if (model.stays.length === 0) {
    return renderEmptyStayList(model);
  }

  return '<ul class="stay-list">' + model.stays.map((stay) => {
    const dateRange = escapeHtml(formatDate(stay.arrivalDate)) +
      '<span aria-hidden="true">–</span><span class="sr-only"> till </span>' +
      escapeHtml(formatDate(stay.departureDate));
    const statusKey = stay.status === "actual" ? "actual" : "planned";
    const status = statusKey === "actual" ? "Faktisk" : "Planerad";

    if (model.demo) {
      return '<li class="stay-row stay-row--' + statusKey + '"><span>' + dateRange +
        '</span><span class="status-label status-label--' + statusKey + '">' +
        status + "</span></li>";
    }

    const escapedId = escapeHtml(stay.id);
    const pastAction = model.pastPlanned.some((item) => item.id === stay.id)
      ? '<div class="stay-outcome"><p>Genomfördes den här planerade vistelsen?</p>' +
        '<button class="secondary-button stay-confirm" type="button" ' +
        'data-action="confirm-actual" data-stay-id="' + escapedId + '">' +
        "Ja, markera som genomförd</button></div>"
      : "";

    return '<li><button class="stay-row stay-row--' + statusKey +
      '" type="button" data-action="edit-stay" ' +
      'data-stay-id="' + escapedId + '"><span>' + dateRange +
      '</span><span class="status-label status-label--' + statusKey + '">' +
      status + "</span></button>" + pastAction + "</li>";
  }).join("") + "</ul>";
}

function renderBudgetStatus(model) {
  const budgetCopy = model.budget.overBy > 0
    ? "Planen ligger " + model.budget.overBy + " " +
      dayWord(model.budget.overBy) + " över din personliga budget"
    : model.budget.remaining + " " + dayWord(model.budget.remaining) +
      " kvar i din personliga budget";
  const boundary = model.budget.lastWithinBudgetDate
    ? "<p>Senaste registrerade dag inom budget: " +
      escapeHtml(formatDate(model.budget.lastWithinBudgetDate)) + "</p>"
    : "<p>Ingen budgetgräns nås av den registrerade planen.</p>";
  const exceeded = model.budget.firstExceededDate
    ? "<p>Första registrerade dag över budget: " +
      escapeHtml(formatDate(model.budget.firstExceededDate)) + "</p>"
    : "";
  const meterValue = Math.min(model.budget.uniqueDays, model.profile.budgetDays);
  const fill = Math.min(100, Math.round(
    (model.budget.uniqueDays / model.profile.budgetDays) * 100
  ));
  const excludedIntervals = mergeDates(model.budget.excludedDates);
  const excluded = model.budget.excludedDays > 0
    ? '<p class="budget-status__excluded">' +
      escapeHtml(model.budget.excludedDays === 1
        ? "1 registrerad dag ligger utanför budgetperioden och räknas inte:"
        : model.budget.excludedDays +
          " registrerade dagar ligger utanför budgetperioden och räknas inte:") +
      ' <span class="edge-ranges">' +
      excludedIntervals.map(renderDateInterval).join(", ") + "</span>.</p>"
    : "";

  return '<section class="budget-status" aria-labelledby="budget-heading">' +
    '<div><p class="section-kicker">Personlig dagbudget</p>' +
    '<h2 id="budget-heading">' + escapeHtml(budgetCopy) + "</h2>" + boundary +
    exceeded + excluded + "</div>" +
    '<div class="budget-meter" role="progressbar" aria-label="Använd dagbudget" ' +
    'aria-valuemin="0" aria-valuemax="' + escapeHtml(model.profile.budgetDays) +
    '" aria-valuenow="' + escapeHtml(meterValue) + '" style="--budget-fill: ' +
    fill + '%"><span aria-hidden="true"></span></div></section>';
}

function renderHeader(model) {
  const actions = model.demo
    ? '<button class="secondary-button secondary-button--inverse" type="button" ' +
      'data-action="exit-demo">Tillbaka till min plan</button>'
    : '<button class="secondary-button secondary-button--inverse" type="button" ' +
      'data-action="edit-profile">Inställningar</button>' +
      '<button class="primary-button" type="button" data-action="add-stay">' +
      "Lägg till vistelse</button>";

  return '<header class="app-header"><div><p class="eyebrow">' +
    "Sverigevistelseplaneraren</p><h1>Din Sverigeöversikt</h1>" +
    '<p class="app-header__disclaimer">Planeringsverktyg, inte juridisk rådgivning.</p>' +
    '</div><div class="header-actions">' + actions + "</div></header>";
}

function renderSummary(model) {
  return '<section class="summary-grid" aria-label="Dagsammanställning">' +
    '<article><strong>' + escapeHtml(model.budget.actualDays) +
    '</strong><span>Faktiska dagar</span></article>' +
    '<article><strong>' + escapeHtml(model.budget.plannedDays) +
    '</strong><span>Planerade dagar</span></article>' +
    '<article><strong>' + escapeHtml(model.budget.uniqueDays) +
    '</strong><span>Unika dagar totalt</span></article>' +
    '<article><strong>' + escapeHtml(model.profile.budgetDays) +
    '</strong><span>Personlig budget</span></article></section>';
}

export function renderCockpit(model) {
  const demoBanner = model.demo
    ? '<div class="demo-banner" role="status">Syntetiskt demoexempel — sparas inte</div>'
    : "";
  const storagePresentation = presentStorageIssue(model.storageIssue);
  const storageBanner = storagePresentation
    ? '<div class="storage-warning" role="' +
      (storagePresentation.blocking ? "alert" : "status") + '">' +
      escapeHtml(storagePresentation.message) + "</div>"
    : "";
  const footer = model.demo
    ? ""
    : '<footer class="app-footer">' + (model.clearRequested
      ? '<section class="inline-confirm" aria-labelledby="clear-heading">' +
        '<h2 id="clear-heading">Rensa all appdata?</h2>' +
        "<p>Det innebär att profilen och alla registrerade vistelser tas bort permanent.</p>" +
        '<div class="inline-confirm__actions">' +
        '<button class="primary-button" type="button" data-action="confirm-clear">' +
        "Ja, rensa all data</button>" +
        '<button class="secondary-button" type="button" data-action="cancel-clear">' +
        "Avbryt</button></div></section>"
      : '<button class="danger-text" type="button" data-action="request-clear">' +
        "Rensa all data</button>") + "</footer>";

  return '<div class="cockpit-shell">' + demoBanner + storageBanner +
    renderHeader(model) + '<div class="cockpit-content">' + renderSummary(model) +
    renderBudgetStatus(model) +
    renderBudgetExplanation(model.explanation) +
    '<div class="legend" aria-label="Kalenderförklaring">' +
    '<span class="legend__item legend--actual"><i aria-hidden="true"></i>Faktisk</span>' +
    '<span class="legend__item legend--planned"><i aria-hidden="true"></i>Planerad</span>' +
    '<span class="legend__item legend--unregistered"><i aria-hidden="true"></i>' +
    "Inte registrerad</span></div>" +
    '<div class="cockpit-layout"><section class="calendar-panel">' +
    '<div class="year-nav"><button type="button" data-action="previous-year" ' +
    'aria-label="Föregående år">←</button><h2>' + escapeHtml(model.year) +
    '</h2><button type="button" data-action="next-year" aria-label="Nästa år">' +
    "→</button></div>" + renderYearCalendar(model) +
    '</section><aside class="cockpit-aside"><section class="aside-card">' +
    "<h2>Vistelser</h2>" + renderStayList(model) +
    '</section><section class="aside-card"><h2>Juridiska observationer</h2>' +
    renderObservations(model.observations, LEGAL_SOURCES) +
    "</section></aside></div>" + footer + "</div></div>";
}
