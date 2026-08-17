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

function renderPreview(preview) {
  if (!preview) return "";
  const stayCount = preview.stayCount === 1
    ? "1 vistelse"
    : preview.stayCount + " vistelser";
  const profile = preview.hasProfile ? "Profil finns" : "Ingen profil";

  return '<section class="inline-confirm" aria-labelledby="restore-heading">'
    + '<h3 id="restore-heading">Ersätt aktuell data?</h3>'
    + "<p><strong>Fil:</strong> " + escapeHtml(preview.fileName) + "</p>"
    + "<p>" + escapeHtml(profile) + ", " + escapeHtml(stayCount) + ".</p>"
    + "<p>Den aktuella profilen och alla vistelser ersätts först när du "
    + "bekräftar.</p>"
    + '<div class="inline-confirm__actions">'
    + '<button class="primary-button" type="button" '
    + 'data-action="confirm-restore">Ja, ersätt aktuell data</button>'
    + '<button class="secondary-button" type="button" '
    + 'data-action="cancel-restore">Avbryt</button></div></section>';
}

export function renderDataTools({
  restorePreview = null,
  canExport = true
} = {}) {
  const exportActions = canExport
    ? '<button type="button" class="secondary-button" '
      + 'data-action="download-backup">Ladda ner backup</button>'
      + '<button type="button" class="secondary-button" '
      + 'data-action="download-csv">Exportera CSV</button>'
    : "";
  return '<section class="aside-card data-tools" '
    + 'aria-labelledby="data-tools-heading">'
    + '<h2 id="data-tools-heading">Din data</h2>'
    + "<p>Backupen sparas som en lokal JSON-fil. CSV innehåller endast "
    + "vistelser.</p>"
    + '<div class="data-tools__actions">'
    + exportActions
    + '<button type="button" class="secondary-button" '
    + 'data-action="choose-restore">Återställ backup</button>'
    + '<input class="sr-only" type="file" '
    + 'accept=".json,application/json" data-file-input="restore">'
    + "</div>" + renderPreview(restorePreview) + "</section>";
}
