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

export function renderObservations(observations, legalSources) {
  if (observations.length === 0) {
    return '<p class="empty-observations">' +
      "Inga observationer från dina registrerade uppgifter.</p>";
  }

  return observations.map((observation) => {
    const source = legalSources[observation.sourceId];
    const scope = observation.scope === "scenario"
      ? "Planerat scenario"
      : "Registrerad historik";
    const evidence = observation.evidence.map((item) =>
      "<li>" + escapeHtml(item) + "</li>"
    ).join("");

    return '<article class="observation observation--' + escapeHtml(observation.level) +
      '" data-observation-id="' + escapeHtml(observation.id) + '">' +
      '<p class="observation__scope">' + scope + "</p>" +
      "<h3>" + escapeHtml(observation.title) + "</h3>" +
      "<p>" + escapeHtml(observation.summary) + "</p>" +
      '<ul class="observation__evidence">' + evidence + "</ul>" +
      '<a href="' + escapeHtml(source.url) +
      '" target="_blank" rel="noopener noreferrer">' +
      escapeHtml(source.title) + "</a>" +
      '<p class="source-date">Senast granskad ' +
      escapeHtml(source.reviewedAt) + "</p>" +
      "</article>";
  }).join("");
}
