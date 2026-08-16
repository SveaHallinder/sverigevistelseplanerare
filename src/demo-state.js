import { CHECKLIST_KEYS } from "./domain/validation.js";

export function createDemoState(today) {
  const year = today.slice(0, 4);
  const unanswered = Object.fromEntries(
    CHECKLIST_KEYS.map((key) => [key, "unanswered"])
  );

  return {
    version: 1,
    demo: true,
    profile: {
      departureDate: String(Number(year) - 1) + "-02-15",
      budgetDays: 90,
      periodStart: year + "-01-01",
      periodEnd: year + "-12-31",
      swedishCitizen: "yes",
      livedInSwedenTenYears: "unanswered",
      connectionChecklist: unanswered
    },
    stays: [
      {
        id: "demo-april",
        arrivalDate: year + "-04-02",
        departureDate: year + "-04-09",
        status: "actual",
        createdAt: year + "-04-01T12:00:00.000Z",
        updatedAt: year + "-04-01T12:00:00.000Z"
      },
      {
        id: "demo-june",
        arrivalDate: year + "-06-18",
        departureDate: year + "-06-28",
        status: "actual",
        createdAt: year + "-06-17T12:00:00.000Z",
        updatedAt: year + "-06-17T12:00:00.000Z"
      },
      {
        id: "demo-august",
        arrivalDate: year + "-08-05",
        departureDate: year + "-08-12",
        status: "planned",
        createdAt: year + "-08-01T12:00:00.000Z",
        updatedAt: year + "-08-01T12:00:00.000Z"
      }
    ]
  };
}
