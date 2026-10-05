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
  if (preview.loading) {
    return '<section class="inline-confirm" aria-labelledby="restore-heading">'
      + '<h3 id="restore-heading">Kontrollerar backupfilen…</h3>'
      + "<p>" + escapeHtml(preview.fileName) + "</p>"
      + "<p>Din nuvarande data har inte ändrats.</p>"
      + '<button class="secondary-button" type="button" '
      + 'data-action="cancel-restore">Avbryt</button></section>';
  }
  const stayCount = preview.stayCount === 1
    ? "1 vistelse"
    : preview.stayCount + " vistelser";
  const profile = preview.hasProfile ? "Profil finns" : "Ingen profil";
  const isEmpty = !preview.hasProfile && preview.stayCount === 0;
  const emptyWarning = isEmpty
    ? "<p><strong>Backupfilen är tom.</strong> Din nuvarande profil och alla "
      + "vistelser tas bort utan att ersättas med något.</p>"
    : "";

  return '<section class="inline-confirm" aria-labelledby="restore-heading">'
    + '<h3 id="restore-heading">Ersätt aktuell data?</h3>'
    + "<p><strong>Fil:</strong> " + escapeHtml(preview.fileName) + "</p>"
    + "<p>" + escapeHtml(profile) + ", " + escapeHtml(stayCount) + ".</p>"
    + emptyWarning
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
  canExport = true,
  native = false
} = {}) {
  const exportActions = canExport
    ? '<button type="button" class="secondary-button" '
      + 'data-action="download-backup">' + (native ? "Spara backup" : "Ladda ner backup") + "</button>"
      + '<button type="button" class="secondary-button" '
      + 'data-action="download-csv">Exportera CSV</button>'
    : "";
  return '<section class="aside-card data-tools" '
    + 'aria-labelledby="data-tools-heading">'
    + '<h2 id="data-tools-heading">Din data</h2>'
    + "<p>Backupen sparas som en lokal JSON-fil och innehåller dina "
    + "profilsvar i läsbar text. Spara den bara där du själv vill ha den. "
    + "CSV innehåller endast vistelser.</p>"
    + '<div class="data-tools__actions">'
    + exportActions
    + '<button type="button" class="secondary-button" '
    + 'data-action="choose-restore">Återställ backup</button>'
    + '<input type="file" hidden tabindex="-1" aria-label="Välj JSON-backup" '
    + 'accept=".json,application/json" data-file-input="restore">'
    + '</div><p class="data-tools__feedback" data-tools-feedback></p>'
    + renderPreview(restorePreview) + "</section>";
}
