const HTML_ENTITIES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) =>
    HTML_ENTITIES[character]);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "long",
    timeZone: "UTC"
  }).format(new Date(value + "T00:00:00Z"));
}

function dayWord(count) {
  return count === 1 ? "dag" : "dagar";
}

function statusLabel(status) {
  return {
    actual: "Faktisk",
    planned: "Planerad",
    overlap: "Faktisk och planerad"
  }[status] ?? "Registrerad";
}

function renderRange(range) {
  const dates = range.startDate === range.endDate
    ? formatDate(range.startDate)
    : formatDate(range.startDate) + "–" + formatDate(range.endDate);
  return "<li><strong>" + escapeHtml(statusLabel(range.status))
    + ":</strong> " + escapeHtml(dates) + "</li>";
}

function renderRanges(title, ranges, emptyText) {
  return "<section><h3>" + escapeHtml(title) + "</h3>"
    + (ranges.length === 0
      ? "<p>" + escapeHtml(emptyText) + "</p>"
      : "<ul>" + ranges.map(renderRange).join("") + "</ul>")
    + "</section>";
}

function renderPattern(label, facts) {
  const visits = facts.visitCount === 1
    ? "1 sammanslaget besök"
    : facts.visitCount + " sammanslagna besök";
  const gaps = facts.gapLengths.length === 0
    ? "Inga oregistrerade mellanrum mellan sammanslagna besök."
    : "Oregistrerade dagar mellan sammanslagna besök: "
      + facts.gapLengths.join(", ") + ".";
  return "<p><strong>" + escapeHtml(label) + ":</strong> "
    + escapeHtml(visits) + ", " + escapeHtml(facts.totalDays)
    + " registrerade dagar, längsta sammanhängande registrering "
    + escapeHtml(facts.longestStayDays) + " dagar. "
    + escapeHtml(gaps) + "</p>";
}

export function renderBudgetExplanation(model) {
  const formula = model.period.budgetDays + " − "
    + model.totals.uniqueDays + " = " + model.totals.remaining;
  const balance = model.totals.overBy > 0
    ? model.totals.overBy + " " + dayWord(model.totals.overBy)
      + " över den personliga budgeten."
    : model.totals.remaining + " " + dayWord(model.totals.remaining)
      + " kvar i den personliga budgeten.";
  const scenario = model.hasPlannedStays
    ? renderPattern("Faktisk plus planerad", model.scenarioPattern)
    : "";

  return '<details class="calculation-details"><summary>Så räknas planen</summary>'
    + '<div class="calculation-details__body">'
    + "<p>Detta förklarar din personliga budget, inte en juridisk gräns.</p>"
    + "<p>Ankomst- och avresedag räknas; överlappande datum räknas en gång "
    + "i budgeten och faktisk status visas först.</p>"
    + '<dl><div><dt>Faktiska dagar</dt><dd>'
    + escapeHtml(model.totals.actualDays) + "</dd></div>"
    + "<div><dt>Planerade dagar</dt><dd>"
    + escapeHtml(model.totals.plannedDays) + "</dd></div>"
    + "<div><dt>Unika dagar</dt><dd>"
    + escapeHtml(model.totals.uniqueDays) + "</dd></div>"
    + "<div><dt>Överlappande dagar</dt><dd>"
    + escapeHtml(model.totals.overlapDays) + "</dd></div></dl>"
    + "<p><strong>Budgetformel:</strong> " + escapeHtml(formula)
    + ". " + escapeHtml(balance) + "</p>"
    + renderRanges(
      "Registrerade intervall i budgetperioden",
      model.includedRanges,
      "Inga registrerade intervall i budgetperioden."
    )
    + renderRanges(
      "Intervall utanför budgetperioden",
      model.excludedRanges,
      "Inga registrerade intervall ligger utanför budgetperioden."
    )
    + renderRanges(
      "Överlapp mellan faktisk och planerad status",
      model.overlapRanges,
      "Inga faktiska och planerade datum överlappar."
    )
    + "<section><h3>Registrerat mönster</h3>"
    + renderPattern("Faktisk historik", model.actualPattern)
    + scenario + "</section></div></details>";
}
