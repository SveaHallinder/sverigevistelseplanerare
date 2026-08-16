import assert from "node:assert/strict";
import test from "node:test";
import * as observationsModule from "../src/domain/observations.js";
import { CHECKLIST_KEYS } from "../src/domain/validation.js";
import * as legalContent from "../src/legal-content.js";

const { buildObservations } = observationsModule;
const { CHECKLIST_CONTENT, LEGAL_SOURCES } = legalContent;

const unansweredChecklist = Object.fromEntries(
  CHECKLIST_KEYS.map((key) => [key, "unanswered"])
);

function profile(overrides = {}) {
  return {
    departureDate: "2025-05-10",
    budgetDays: 90,
    periodStart: "2026-01-01",
    periodEnd: "2026-12-31",
    swedishCitizen: "unanswered",
    livedInSwedenTenYears: "unanswered",
    ...overrides,
    connectionChecklist: {
      ...unansweredChecklist,
      ...overrides.connectionChecklist
    }
  };
}

test("legal content exposes the exact reviewed source configuration", () => {
  assert.deepEqual(Object.keys(legalContent).sort(), [
    "CHECKLIST_CONTENT",
    "LEGAL_SOURCES"
  ]);
  assert.deepEqual(LEGAL_SOURCES, {
    incomeTaxAct: {
      title: "Inkomstskattelagen, 3 kap. 3 och 7 §§",
      url: "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/inkomstskattelag-19991229_sfs-1999-1229/",
      reviewedAt: "2026-08-16"
    },
    movedFromSweden: {
      title: "Skatteverket: Har du flyttat från Sverige?",
      url: "https://www.skatteverket.se/privat/internationellt/bosattutomlands/harduflyttatfransverige.4.7459477810df5bccdd4800030036.html",
      reviewedAt: "2026-08-16"
    },
    permanentStay: {
      title: "Skatteverket: Stadigvarande vistelse i Sverige",
      url: "https://www4.skatteverket.se/rattsligvagledning/edition/2026.7/2637.html",
      reviewedAt: "2026-08-16"
    },
    taxTreatyResidence: {
      title: "Skatteverket: Artikel 4 och skatteavtalshemvist",
      url: "https://www4.skatteverket.se/rattsligvagledning/edition/2026.5/2970.html",
      reviewedAt: "2026-08-16"
    },
    sink183: {
      title: "Skatteverket: 183-dagarsregeln i SINK",
      url: "https://www.skatteverket.se/privat/etjansterochblanketter/svarpavanligafragor/sink/sink/vadar183dagarsregelnisinkochvadinnebarden.5.5b35a6251761e6914206793.html",
      reviewedAt: "2026-08-16"
    }
  });
});

test("checklist content covers every validation key with exact copy", () => {
  assert.deepEqual(Object.keys(CHECKLIST_CONTENT), CHECKLIST_KEYS);
  assert.deepEqual(CHECKLIST_CONTENT, {
    yearRoundHome: {
      label: "Har du en bostad i Sverige som är inrättad för åretruntbruk?",
      sourceId: "movedFromSweden"
    },
    spouseOrMinorChildren: {
      label: "Har du make, maka eller minderåriga barn kvar i Sverige?",
      sourceId: "movedFromSweden"
    },
    businessInSweden: {
      label: "Bedriver du näringsverksamhet i Sverige?",
      sourceId: "incomeTaxAct"
    },
    businessInfluence: {
      label: "Har du tillgångar som kan ge väsentligt inflytande i svensk näringsverksamhet?",
      sourceId: "incomeTaxAct"
    },
    propertyInSweden: {
      label: "Har du fastighet i Sverige?",
      sourceId: "incomeTaxAct"
    },
    otherStrongTies: {
      label: "Har du andra starka personliga eller ekonomiska band till Sverige?",
      sourceId: "movedFromSweden"
    },
    workDuringStays: {
      label: "Arbetar du under dina vistelser i Sverige?",
      sourceId: "sink183"
    }
  });
});

test("observations exports only buildObservations", () => {
  assert.deepEqual(Object.keys(observationsModule), ["buildObservations"]);
});

test("tax treaty boundary is always informational and source-backed", () => {
  const observations = buildObservations(profile(), []);

  assert.deepEqual(observations, [{
    id: "tax-treaty-boundary",
    level: "info",
    scope: "actual",
    title: "Skatteavtalshemvist ingår inte i beräkningen",
    summary: "Appen räknar registrerade Sverigedagar men avgör inte hemvist enligt skatteavtal.",
    evidence: ["Endast registrerade datum och frivilliga profilsvar används."],
    sourceId: "taxTreatyResidence",
    reviewedAt: "2026-08-16"
  }]);
});

test("citizenship or ten years in Sweden adds the five-year evidence date", () => {
  const qualifyingProfiles = [
    profile({ swedishCitizen: "yes", livedInSwedenTenYears: "no" }),
    profile({ swedishCitizen: "no", livedInSwedenTenYears: "yes" }),
    profile({ swedishCitizen: "yes", livedInSwedenTenYears: "yes" })
  ];

  for (const candidate of qualifyingProfiles) {
    const rows = buildObservations(candidate, [])
      .filter((row) => row.id === "five-year-evidence");
    assert.deepEqual(rows, [{
      id: "five-year-evidence",
      level: "info",
      scope: "actual",
      title: "Femårsdag för bevisbördeperioden",
      summary: "Fem år är inte en automatisk skattefri gräns. Väsentlig anknytning kan behöva bedömas även senare.",
      evidence: [
        "Utflyttningsdatum 2025-05-10",
        "Femårsdag 2030-05-10"
      ],
      sourceId: "incomeTaxAct",
      reviewedAt: "2026-08-16"
    }]);
  }
});

test("no and unanswered do not add five-year evidence", () => {
  for (const answer of ["no", "unanswered"]) {
    const observations = buildObservations(profile({
      swedishCitizen: answer,
      livedInSwedenTenYears: answer
    }), []);

    assert.equal(
      observations.some((row) => row.id === "five-year-evidence"),
      false
    );
  }
});

test("each affirmative connection answer creates its own keyed observation", () => {
  for (const key of CHECKLIST_KEYS.filter((item) => item !== "workDuringStays")) {
    const observations = buildObservations(profile({
      connectionChecklist: { [key]: "yes" }
    }), []);
    const connections = observations.filter((row) =>
      row.id.startsWith("connection-"));

    assert.deepEqual(connections, [{
      id: "connection-" + key,
      level: "review",
      scope: "actual",
      title: "Uppgift att granska: " + CHECKLIST_CONTENT[key].label,
      summary: "Kräver individuell bedömning.",
      evidence: ['Du svarade "Ja" på frågan.'],
      sourceId: CHECKLIST_CONTENT[key].sourceId,
      reviewedAt: "2026-08-16"
    }]);
  }
});

test("negative and unanswered connection answers create no observations", () => {
  for (const answer of ["no", "unanswered"]) {
    const observations = buildObservations(profile({
      connectionChecklist: Object.fromEntries(
        CHECKLIST_KEYS.map((key) => [key, answer])
      )
    }), []);

    assert.equal(
      observations.some((row) => row.id.startsWith("connection-")),
      false
    );
    assert.equal(
      observations.some((row) => row.id === "work-rolling-window"),
      false
    );
  }
});

test("actual six-month facts remain actual and use exact neutral copy", () => {
  const observations = buildObservations(profile(), [{
    arrivalDate: "2026-01-01",
    departureDate: "2026-07-01",
    status: "actual"
  }]);

  assert.deepEqual(
    observations.find((row) => row.id === "six-month-actual-2026-01-01"),
    {
      id: "six-month-actual-2026-01-01",
      level: "review",
      scope: "actual",
      title: "Sammanhängande registrering når sexmånadersdagen",
      summary: "vistelsens juridiska betydelse kräver individuell bedömning.",
      evidence: [
        "Registrerad från 2026-01-01 till 2026-07-01",
        "Sexmånadersdag 2026-07-01"
      ],
      sourceId: "permanentStay",
      reviewedAt: "2026-08-16"
    }
  );
});

test("actual temporary-gap facts use exact evidence and copy", () => {
  const observations = buildObservations(profile(), [
    {
      arrivalDate: "2026-01-01",
      departureDate: "2026-01-10",
      status: "actual"
    },
    {
      arrivalDate: "2026-01-16",
      departureDate: "2026-01-25",
      status: "actual"
    }
  ]);

  assert.deepEqual(
    observations.find((row) => row.id === "temporary-gap-actual-2026-01-11"),
    {
      id: "temporary-gap-actual-2026-01-11",
      level: "review",
      scope: "actual",
      title: "Möjligt tillfälligt avbrott",
      summary: "mellanrummet kan behöva bedömas tillsammans med vistelserna.",
      evidence: [
        "10 registrerade dagar före",
        "5 oregistrerade dagar mellan",
        "10 registrerade dagar efter"
      ],
      sourceId: "permanentStay",
      reviewedAt: "2026-08-16"
    }
  );
});

test("a pattern introduced by planned dates is marked as a scenario", () => {
  const observations = buildObservations(profile(), [
    {
      arrivalDate: "2026-01-01",
      departureDate: "2026-01-10",
      status: "actual"
    },
    {
      arrivalDate: "2026-01-11",
      departureDate: "2026-07-01",
      status: "planned"
    }
  ]);
  const scenario = observations.find((row) =>
    row.id === "six-month-scenario-2026-01-01");

  assert.equal(scenario.scope, "scenario");
  assert.equal(scenario.summary.startsWith("Om planen genomförs: "), true);
  assert.deepEqual(scenario.evidence, [
    "Registrerad från 2026-01-01 till 2026-07-01",
    "Sexmånadersdag 2026-07-01"
  ]);
});

test("combined facts do not duplicate an exact actual pattern fact", () => {
  const observations = buildObservations(profile(), [
    {
      arrivalDate: "2026-01-01",
      departureDate: "2026-07-01",
      status: "actual"
    },
    {
      arrivalDate: "2027-12-01",
      departureDate: "2027-12-01",
      status: "planned"
    }
  ]);
  const matchingFacts = observations.filter((row) =>
    row.title === "Sammanhängande registrering når sexmånadersdagen"
    && row.evidence[0] === "Registrerad från 2026-01-01 till 2026-07-01");

  assert.equal(matchingFacts.length, 1);
  assert.equal(matchingFacts[0].scope, "actual");
});

test("a separate planned gap survives matching actual gap lengths", () => {
  const observations = buildObservations(profile(), [
    {
      arrivalDate: "2026-01-01",
      departureDate: "2026-01-10",
      status: "actual"
    },
    {
      arrivalDate: "2026-01-16",
      departureDate: "2026-01-25",
      status: "actual"
    },
    {
      arrivalDate: "2026-03-01",
      departureDate: "2026-03-10",
      status: "planned"
    },
    {
      arrivalDate: "2026-03-16",
      departureDate: "2026-03-25",
      status: "planned"
    }
  ]);
  const gapRows = observations.filter((row) =>
    row.title === "Möjligt tillfälligt avbrott");

  assert.deepEqual(gapRows.map((row) => ({
    id: row.id,
    scope: row.scope
  })), [
    {
      id: "temporary-gap-actual-2026-01-11",
      scope: "actual"
    },
    {
      id: "temporary-gap-scenario-2026-03-11",
      scope: "scenario"
    }
  ]);
  assert.equal(gapRows[1].summary.startsWith("Om planen genomförs: "), true);
  assert.deepEqual(gapRows[0].evidence, gapRows[1].evidence);
});

test("work observation becomes a scenario when planned stays are present", () => {
  const observations = buildObservations(profile({
    connectionChecklist: { workDuringStays: "yes" }
  }), [
    {
      arrivalDate: "2026-01-01",
      departureDate: "2026-01-02",
      status: "actual"
    },
    {
      arrivalDate: "2026-01-03",
      departureDate: "2026-01-05",
      status: "planned"
    }
  ]);

  assert.deepEqual(
    observations.find((row) => row.id === "work-rolling-window"),
    {
      id: "work-rolling-window",
      level: "info",
      scope: "scenario",
      title: "Arbete under Sverigebesök",
      summary: "Om planen genomförs: 183 dagar är inte en generell safe harbour och övriga villkor måste bedömas.",
      evidence: [
        "Faktisk historik: högst 2 registrerade dagar i ett tolvmånadersfönster",
        "Faktisk plus planerad: högst 5 registrerade dagar i ett tolvmånadersfönster"
      ],
      sourceId: "sink183",
      reviewedAt: "2026-08-16"
    }
  );
});

test("work observation stays actual without planned stays", () => {
  const observations = buildObservations(profile({
    connectionChecklist: { workDuringStays: "yes" }
  }), [{
    arrivalDate: "2026-01-01",
    departureDate: "2026-01-02",
    status: "actual"
  }]);
  const work = observations.find((row) => row.id === "work-rolling-window");

  assert.equal(work.scope, "actual");
  assert.equal(
    work.summary,
    "183 dagar är inte en generell safe harbour och övriga villkor måste bedömas."
  );
  assert.deepEqual(work.evidence, [
    "Faktisk historik: högst 2 registrerade dagar i ett tolvmånadersfönster",
    "Faktisk plus planerad: högst 2 registrerade dagar i ett tolvmånadersfönster"
  ]);
});

test("every observation has evidence and matching reviewed source metadata", () => {
  const observations = buildObservations(profile({
    swedishCitizen: "yes",
    connectionChecklist: {
      yearRoundHome: "yes",
      workDuringStays: "yes"
    }
  }), [
    {
      arrivalDate: "2026-01-01",
      departureDate: "2026-07-01",
      status: "actual"
    },
    {
      arrivalDate: "2026-07-10",
      departureDate: "2026-07-20",
      status: "planned"
    }
  ]);

  for (const observation of observations) {
    assert.equal(Array.isArray(observation.evidence), true);
    assert.equal(observation.evidence.length > 0, true);
    assert.equal(observation.evidence.every((item) => item.length > 0), true);
    assert.equal(Object.hasOwn(LEGAL_SOURCES, observation.sourceId), true);
    assert.equal(
      observation.reviewedAt,
      LEGAL_SOURCES[observation.sourceId].reviewedAt
    );
  }
});

test("output avoids claims of legal certainty", () => {
  const output = JSON.stringify(buildObservations(profile({
    swedishCitizen: "yes",
    connectionChecklist: Object.fromEntries(
      CHECKLIST_KEYS.map((key) => [key, "yes"])
    )
  }), [{
    arrivalDate: "2026-01-01",
    departureDate: "2026-07-01",
    status: "planned"
  }])).toLowerCase();

  for (const forbidden of ["lagligt", "olagligt", "juridiskt säker"]) {
    assert.equal(output.includes(forbidden), false);
  }
});

test("buildObservations is immutable and deterministically ordered", () => {
  const inputProfile = profile({
    swedishCitizen: "yes",
    connectionChecklist: {
      yearRoundHome: "yes",
      businessInSweden: "yes",
      workDuringStays: "yes"
    }
  });
  const stays = [
    {
      arrivalDate: "2026-01-01",
      departureDate: "2026-01-10",
      status: "actual"
    },
    {
      arrivalDate: "2026-01-11",
      departureDate: "2026-07-01",
      status: "planned"
    }
  ];
  const profileBefore = structuredClone(inputProfile);
  const staysBefore = structuredClone(stays);

  const first = buildObservations(inputProfile, stays);
  const second = buildObservations(inputProfile, stays);

  assert.deepEqual(first, second);
  assert.deepEqual(inputProfile, profileBefore);
  assert.deepEqual(stays, staysBefore);

  const levelOrder = { review: 0, info: 1 };
  const scopeOrder = { actual: 0, scenario: 1 };
  const sorted = [...first].sort((left, right) =>
    levelOrder[left.level] - levelOrder[right.level]
    || scopeOrder[left.scope] - scopeOrder[right.scope]
    || left.id.localeCompare(right.id));
  assert.deepEqual(first, sorted);
});
