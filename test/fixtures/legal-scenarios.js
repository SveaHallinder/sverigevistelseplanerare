const SOURCE_URL =
  "https://www4.skatteverket.se/rattsligvagledning/edition/2026.7/2637.html";

function scenario(name, before, after, expectedObservation) {
  return Object.freeze({
    name,
    sourceId: "permanentStay",
    sourceUrl: SOURCE_URL,
    reviewedAt: "2026-08-16",
    intervals: Object.freeze([
      Object.freeze(before),
      Object.freeze(after)
    ]),
    expectedObservation
  });
}

export const TEMPORARY_BREAK_SCENARIOS = Object.freeze([
  scenario(
    "gap shorter than both neighbouring stays",
    { arrivalDate: "2026-01-01", departureDate: "2026-03-31" },
    { arrivalDate: "2026-06-01", departureDate: "2026-08-31" },
    true
  ),
  scenario(
    "gap longer than the previous but shorter than the following stay",
    { arrivalDate: "2026-01-01", departureDate: "2026-02-28" },
    { arrivalDate: "2026-06-01", departureDate: "2026-09-30" },
    true
  ),
  scenario(
    "gap longer than both neighbouring stays",
    { arrivalDate: "2026-01-01", departureDate: "2026-02-28" },
    { arrivalDate: "2026-06-01", departureDate: "2026-07-31" },
    false
  ),
  scenario(
    "gap reaching the six-month boundary",
    { arrivalDate: "2025-01-01", departureDate: "2025-12-31" },
    { arrivalDate: "2026-07-02", departureDate: "2027-06-30" },
    false
  )
]);
