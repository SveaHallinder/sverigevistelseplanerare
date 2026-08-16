import { addYearsClamped } from "./dates.js";
import { calculatePatternFacts } from "./patterns.js";
import { CHECKLIST_CONTENT, LEGAL_SOURCES } from "../legal-content.js";

function createObservation({
  id,
  level = "review",
  scope = "actual",
  title,
  summary = "Kräver individuell bedömning.",
  evidence,
  sourceId
}) {
  return {
    id,
    level,
    scope,
    title,
    summary,
    evidence,
    sourceId,
    reviewedAt: LEGAL_SOURCES[sourceId].reviewedAt
  };
}

function patternObservations(facts, scope) {
  const prefix = scope === "scenario" ? "Om planen genomförs: " : "";
  const observations = [];

  for (const stay of facts.sixMonthStays) {
    observations.push(createObservation({
      id: "six-month-" + scope + "-" + stay.arrivalDate,
      scope,
      title: "Sammanhängande registrering når sexmånadersdagen",
      summary: prefix + "vistelsens juridiska betydelse kräver individuell bedömning.",
      evidence: [
        "Registrerad från " + stay.arrivalDate + " till " + stay.departureDate,
        "Sexmånadersdag " + stay.sixMonthDate
      ],
      sourceId: "permanentStay"
    }));
  }

  for (const gap of facts.possibleTemporaryBreaks) {
    observations.push(createObservation({
      id: "temporary-gap-" + scope + "-" + gap.gapStart,
      scope,
      title: "Möjligt tillfälligt avbrott",
      summary: prefix + "mellanrummet kan behöva bedömas tillsammans med vistelserna.",
      evidence: [
        gap.beforeDays + " registrerade dagar före",
        gap.gapDays + " oregistrerade dagar mellan",
        gap.afterDays + " registrerade dagar efter"
      ],
      sourceId: "permanentStay"
    }));
  }

  return observations;
}

function patternFactKey(observation) {
  return observation.id.replace(/-(actual|scenario)-/, "-")
    + "|" + observation.evidence.join("|");
}

export function buildObservations(profile, stays) {
  const actualStays = stays.filter((stay) => stay.status === "actual");
  const hasPlannedStays = stays.some((stay) => stay.status === "planned");
  const actualFacts = calculatePatternFacts(actualStays);
  const combinedFacts = calculatePatternFacts(stays);
  const observations = [];

  observations.push(createObservation({
    id: "tax-treaty-boundary",
    level: "info",
    title: "Skatteavtalshemvist ingår inte i beräkningen",
    summary: "Appen räknar registrerade Sverigedagar men avgör inte hemvist enligt skatteavtal.",
    evidence: ["Endast registrerade datum och frivilliga profilsvar används."],
    sourceId: "taxTreatyResidence"
  }));

  if (profile.swedishCitizen === "yes" || profile.livedInSwedenTenYears === "yes") {
    observations.push(createObservation({
      id: "five-year-evidence",
      level: "info",
      title: "Femårsdag för bevisbördeperioden",
      summary: "Fem år innebär inte automatisk skattskyldighet och är inte en automatisk skattefri gräns. Väsentlig anknytning kan behöva bedömas även senare.",
      evidence: [
        "Utflyttningsdatum " + profile.departureDate,
        "Femårsdag " + addYearsClamped(profile.departureDate, 5)
      ],
      sourceId: "incomeTaxAct"
    }));
  }

  for (const [key, value] of Object.entries(profile.connectionChecklist)) {
    if (value !== "yes" || key === "workDuringStays") {
      continue;
    }

    const content = CHECKLIST_CONTENT[key];
    observations.push(createObservation({
      id: "connection-" + key,
      title: "Uppgift att granska: " + content.label,
      evidence: ['Du svarade "Ja" på frågan.'],
      sourceId: content.sourceId
    }));
  }

  const actualPatternRows = patternObservations(actualFacts, "actual");
  observations.push(...actualPatternRows);

  const actualPatternKeys = new Set(actualPatternRows.map(patternFactKey));
  observations.push(...patternObservations(combinedFacts, "scenario").filter((row) =>
    !actualPatternKeys.has(patternFactKey(row))));

  if (profile.connectionChecklist.workDuringStays === "yes") {
    observations.push(createObservation({
      id: "work-rolling-window",
      level: "info",
      scope: hasPlannedStays ? "scenario" : "actual",
      title: "Arbete under Sverigebesök",
      summary: (hasPlannedStays ? "Om planen genomförs: " : "")
        + "183 dagar är inte en generell safe harbour och övriga villkor måste bedömas.",
      evidence: [
        "Faktisk historik: högst " + actualFacts.maxRollingTwelveMonths.count
          + " registrerade dagar i ett tolvmånadersfönster",
        "Faktisk plus planerad: högst " + combinedFacts.maxRollingTwelveMonths.count
          + " registrerade dagar i ett tolvmånadersfönster"
      ],
      sourceId: "sink183"
    }));
  }

  const levelOrder = { review: 0, info: 1 };
  const scopeOrder = { actual: 0, scenario: 1 };
  return observations.sort((left, right) =>
    levelOrder[left.level] - levelOrder[right.level]
    || scopeOrder[left.scope] - scopeOrder[right.scope]
    || left.id.localeCompare(right.id));
}
