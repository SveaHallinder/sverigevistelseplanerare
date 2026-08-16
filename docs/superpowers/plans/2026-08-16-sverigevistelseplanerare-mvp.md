# Sverigevistelseplanerare MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Bygg en beroendefri, local-first webbapp där en redan utflyttad användare kan logga och planera Sverigebesök, följa en personlig dagbudget och se transparenta juridiska observationer utan att appen lämnar juridiska slutsatser.

**Architecture:** En statisk webbapp med små ES-moduler delar upp kalenderaritmetik, validering, state, budget, mönster, observationer, lagring och rendering. All domänlogik är ren och testas med Node:s inbyggda test runner; webbläsarkoden koordineras av en testbar controller och sparar ett versionsmärkt dokument via localStorage med fallback till sessionStorage och därefter minne.

**Tech Stack:** Semantisk HTML, modern CSS, vanilla JavaScript ES modules, Node.js 20+ built-ins, node:test, localStorage och sessionStorage. Inga tredjepartsdependencies.

---

## Scope och genomförande

Planen implementerar en sammanhängande MVP, inte flera fristående produkter. Konto, backend, destinationslandsregler, kalenderimport, export, betalning och juridisk riskpoäng ligger uttryckligen utanför.

Kör implementationen i en isolerad Git-worktree skapad från den rena branchen dev. Läs först:

- docs/superpowers/specs/2026-08-16-sverigevistelseplanerare-design.md
- denna plan

Varje task följer red-green-refactor i små steg och avslutas med en egen commit. Lägg inte till npm-paket.

## Låsta algoritmbeslut

1. Faktiska dagar är mängden unika datum i faktiska intervall.
2. Planerade dagar är mängden unika datum i planerade intervall, även när ett datum också är faktiskt.
3. Totalen och budgeten använder unionen av båda mängderna; faktisk status har endast presentationsföreträde.
4. Budgetdatum sorteras kronologiskt. När totalen når budgeten är det datumet lastWithinBudgetDate. Om totalen är lägre än budgeten är värdet null.
5. När totalen överskrider budgeten är budgetens nästa registrerade datum firstExceededDate.
6. Preview vid redigering tar bort den gamla versionen av vistelsen innan kandidaten räknas.
7. Femårsdag och sexmånadersdag klampar 29 februari eller månadsslut till sista giltiga dagen i målmånaden.
8. Ett rullande tolvmånadersfönster som börjar 29 februari slutar 28 februari året därpå; övriga fönster slutar dagen före motsvarande datum året därpå.
9. Juridiska mönster räknas separat för faktisk historik och kombinerad faktisk plus planerad historik. Planerade observationer märks tydligt som scenario.
10. Dagens datum är användarens lokala kalenderdag och injiceras som YYYY-MM-DD i domänlogiken.
11. Demoexemplet är en temporär preview och skriver aldrig till lagring.
12. Version 1 är enda stödda lagringsversion. Okänd äldre eller nyare version bevaras orörd och kräver uttrycklig rensning innan en ny profil sparas.

## Filkarta

~~~text
package.json
index.html
styles.css
README.md
src/
  main.js
  controller.js
  demo-state.js
  legal-content.js
  storage.js
  domain/
    dates.js
    validation.js
    state.js
    stays.js
    budget.js
    patterns.js
    observations.js
  ui/
    onboarding.js
    cockpit.js
    stay-dialog.js
    observations.js
scripts/
  build.mjs
  lint.mjs
  serve.mjs
test/
  tooling.test.js
  dates.test.js
  validation.test.js
  state.test.js
  stays.test.js
  budget.test.js
  patterns.test.js
  observations.test.js
  storage.test.js
  ui.test.js
  controller.test.js
docs/qa/
  localhost.md
~~~

Filansvar:

- src/domain innehåller ingen DOM-, lagrings- eller källcopy.
- src/legal-content.js innehåller checklistefält, neutral juridisk copy, officiella URL:er och reviewedAt.
- src/storage.js serialiserar endast den tillåtna modellen och loggar aldrig profildata eller datum.
- src/ui producerar markup eller uppdaterar den native dialog som den äger; UI räknar aldrig dagar.
- src/controller.js äger testbara use cases och mutationer.
- src/main.js binder webbläsarevents, fokus och rendering.

Gemensamma returkontrakt:

~~~text
ValidationResult<T> = { ok: true, value: T }
                    | { ok: false, fieldErrors: Record<string, string>, message: string }

MutationResult = ValidationResult<AppState>

StorageLoadResult = {
  state: AppState | null,
  issue: null | { code: string, message: string },
  mode: "local" | "session" | "memory"
}

ControllerResult = {
  ok: boolean,
  fieldErrors: Record<string, string>,
  message: string
}
~~~

### Task 1: Beroendefri scaffold, build och lokal server

**Files:**

- Create: package.json
- Create: index.html
- Create: styles.css
- Create: src/main.js
- Create: scripts/build.mjs
- Create: scripts/lint.mjs
- Create: scripts/serve.mjs
- Create: test/tooling.test.js

- [ ] **Step 1: Skapa package scripts utan dependencies**

Skapa package.json:

~~~json
{
  "name": "sverigevistelseplanerare",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "dev": "node scripts/serve.mjs .",
    "preview": "node scripts/serve.mjs dist",
    "build": "node scripts/build.mjs",
    "lint": "node scripts/lint.mjs",
    "test": "node --test",
    "check": "npm run lint && npm test && npm run build"
  }
}
~~~

- [ ] **Step 2: Skriv ett failing tooling-test**

Skapa test/tooling.test.js med tester som:

~~~js
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { build } from "../scripts/build.mjs";
import { createStaticServer } from "../scripts/serve.mjs";

test("build copies only public application files", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "sv-plan-root-"));
  const outDir = await mkdtemp(join(tmpdir(), "sv-plan-out-"));
  await mkdir(join(rootDir, "src"));
  await writeFile(join(rootDir, "index.html"), "<main>app</main>");
  await writeFile(join(rootDir, "styles.css"), "body{}");
  await writeFile(join(rootDir, "src", "main.js"), "export const ready = true;");
  await writeFile(join(rootDir, "secret.txt"), "never copy");

  await build({ rootDir, outDir });

  assert.equal(await readFile(join(outDir, "index.html"), "utf8"), "<main>app</main>");
  await assert.rejects(readFile(join(outDir, "secret.txt"), "utf8"));
});

test("server serves index and rejects dotfiles", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "sv-plan-serve-"));
  await writeFile(join(rootDir, "index.html"), "<main>ok</main>");
  await writeFile(join(rootDir, ".hidden"), "secret");
  const server = createStaticServer(rootDir);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const base = "http://127.0.0.1:" + address.port;

  assert.equal((await fetch(base + "/")).status, 200);
  assert.equal((await fetch(base + "/.hidden")).status, 404);
  await new Promise((resolve) => server.close(resolve));
});
~~~

- [ ] **Step 3: Kör testet och verifiera rött**

Run: npm test -- test/tooling.test.js

Expected: FAIL med ERR_MODULE_NOT_FOUND för scripts/build.mjs eller scripts/serve.mjs.

- [ ] **Step 4: Implementera build, server, lint och minimalt appskal**

scripts/build.mjs ska exportera build({ rootDir, outDir }), radera endast det explicit lösta outDir, skapa katalogen och kopiera index.html, styles.css samt src. scripts/serve.mjs ska exportera createStaticServer(rootDir), tillåta endast index.html, styles.css och src/, neka dotfiles och path traversal, använda korrekta MIME-typer och logga serverfel med prefixet [sverigevistelseplanerare serve]. scripts/lint.mjs ska rekursivt köra node --check på .js och .mjs, validera package.json och underkänna trailing whitespace.

Implementera scripts/build.mjs:

~~~js
import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(scriptDir, "..");

export async function build({
  rootDir = defaultRoot,
  outDir = join(defaultRoot, "dist")
} = {}) {
  const sourceRoot = resolve(rootDir);
  const outputRoot = resolve(outDir);
  if (outputRoot === sourceRoot || outputRoot === parse(outputRoot).root) {
    throw new Error("[sverigevistelseplanerare build] Osäkert mål för build.");
  }
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  await Promise.all([
    cp(join(sourceRoot, "index.html"), join(outputRoot, "index.html")),
    cp(join(sourceRoot, "styles.css"), join(outputRoot, "styles.css")),
    cp(join(sourceRoot, "src"), join(outputRoot, "src"), { recursive: true })
  ]);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  build().catch((error) => {
    console.error("[sverigevistelseplanerare build] " + error.message);
    process.exitCode = 1;
  });
}
~~~

Implementera scripts/serve.mjs:

~~~js
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

function allowed(relativePath) {
  return relativePath === "index.html" ||
    relativePath === "styles.css" ||
    relativePath.startsWith("src/");
}

export function createStaticServer(rootDir) {
  const root = resolve(rootDir);
  return createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
      const filePath = resolve(root, relativePath);
      const insideRoot = filePath === root || filePath.startsWith(root + sep);
      if (!insideRoot || relativePath.split("/").some((part) => part.startsWith(".")) ||
          !allowed(relativePath)) {
        response.writeHead(404).end("Not found");
        return;
      }
      const info = await stat(filePath);
      if (!info.isFile()) {
        response.writeHead(404).end("Not found");
        return;
      }
      response.writeHead(200, {
        "content-type": MIME[extname(filePath)] ?? "application/octet-stream",
        "cache-control": "no-store"
      });
      createReadStream(filePath).pipe(response);
    } catch (error) {
      if (error.code === "ENOENT") {
        response.writeHead(404).end("Not found");
        return;
      }
      console.error("[sverigevistelseplanerare serve] " + error.message);
      response.writeHead(500).end("Server error");
    }
  });
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  const rootDir = resolve(process.argv[2] ?? ".");
  const server = createStaticServer(rootDir);
  server.listen(4173, "127.0.0.1", () => {
    console.log("[sverigevistelseplanerare serve] http://localhost:4173");
  });
}
~~~

Implementera scripts/lint.mjs:

~~~js
import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { extname, join, resolve } from "node:path";

const root = resolve(".");
const scanRoots = ["src", "scripts", "test"];

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  }));
  return nested.flat();
}

const files = (await Promise.all(scanRoots.map((path) => filesBelow(join(root, path))))).flat();
const scripts = files.filter((path) => [".js", ".mjs"].includes(extname(path)));
const textFiles = [...files, join(root, "index.html"), join(root, "styles.css"), join(root, "package.json")];
let failed = false;

for (const path of scripts) {
  const checked = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
  if (checked.status !== 0) {
    process.stderr.write(checked.stderr);
    failed = true;
  }
  const text = await readFile(path, "utf8");
  if (path.startsWith(join(root, "src")) && /\bconsole\./.test(text)) {
    process.stderr.write("Console-anrop är inte tillåtna i src: " + path + "\n");
    failed = true;
  }
}

for (const path of textFiles) {
  if (/[ \t]+$/m.test(await readFile(path, "utf8"))) {
    process.stderr.write("Trailing whitespace: " + path + "\n");
    failed = true;
  }
}

JSON.parse(await readFile(join(root, "package.json"), "utf8"));
if (failed) process.exitCode = 1;
~~~

Skapa index.html med följande stabila hooks:

~~~html
<!doctype html>
<html lang="sv">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Planera och dokumentera registrerade Sverigedagar.">
    <title>Sverigevistelseplaneraren</title>
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body>
    <div id="storage-banner" hidden role="status"></div>
    <main id="app" tabindex="-1">
      <p>Laddar Sverigevistelseplaneraren.</p>
    </main>
    <div id="live-region" class="sr-only" aria-live="polite"></div>
    <dialog id="stay-dialog" aria-labelledby="stay-dialog-title"></dialog>
    <noscript>JavaScript måste vara aktiverat för att använda planeraren.</noscript>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
~~~

Låt src/main.js endast ersätta laddningstexten med ett tillfälligt tomläge i denna task. styles.css ska innehålla box-sizing, läsbar systemfont, sr-only och synligt :focus-visible.

- [ ] **Step 5: Verifiera tooling**

Run: npm run lint

Expected: exit 0.

Run: npm test -- test/tooling.test.js

Expected: 2 tests pass.

Run: npm run build

Expected: dist/index.html, dist/styles.css och dist/src/main.js finns; inga andra repo-filer finns i dist.

- [ ] **Step 6: Commit**

~~~bash
git add package.json index.html styles.css src/main.js scripts test/tooling.test.js
git commit -m "chore: scaffold dependency-free web app"
~~~

### Task 2: UTC-säker kalenderaritmetik

**Files:**

- Create: src/domain/dates.js
- Create: test/dates.test.js

- [ ] **Step 1: Skriv failing datumtester**

Skapa test/dates.test.js:

~~~js
import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  addMonthsClamped,
  addYearsClamped,
  daysInclusive,
  eachDateInclusive,
  isIsoDate,
  rollingYearEnd,
  todayLocalIso
} from "../src/domain/dates.js";

test("validates real ISO calendar dates", () => {
  assert.equal(isIsoDate("2028-02-29"), true);
  assert.equal(isIsoDate("2026-02-29"), false);
  assert.equal(isIsoDate("16-08-2026"), false);
});

test("counts inclusive dates across year and DST boundaries", () => {
  assert.equal(daysInclusive("2026-08-16", "2026-08-16"), 1);
  assert.deepEqual(eachDateInclusive("2025-12-30", "2026-01-03"), [
    "2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02", "2026-01-03"
  ]);
  assert.equal(daysInclusive("2026-03-28", "2026-03-30"), 3);
  assert.equal(daysInclusive("2026-10-24", "2026-10-26"), 3);
});

test("clamps month and year anniversaries", () => {
  assert.equal(addMonthsClamped("2026-08-31", 6), "2027-02-28");
  assert.equal(addYearsClamped("2028-02-29", 5), "2033-02-28");
  assert.equal(rollingYearEnd("2024-02-29"), "2025-02-28");
  assert.equal(rollingYearEnd("2025-03-01"), "2026-02-28");
});

test("uses the injected local calendar date", () => {
  assert.equal(todayLocalIso(new Date(2026, 7, 16, 23, 30)), "2026-08-16");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});
~~~

- [ ] **Step 2: Kör testet och verifiera rött**

Run: npm test -- test/dates.test.js

Expected: FAIL med ERR_MODULE_NOT_FOUND för src/domain/dates.js.

- [ ] **Step 3: Implementera exakta datumprimitiver**

src/domain/dates.js ska använda Date.UTC internt och exportera exakt:

~~~js
const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value) {
  const match = typeof value === "string" && ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

export function toEpochDay(value) {
  if (!isIsoDate(value)) throw new TypeError("Ogiltigt kalenderdatum: " + value);
  const [year, month, day] = value.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

export function fromEpochDay(value) {
  return new Date(value * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(value, amount) {
  return fromEpochDay(toEpochDay(value) + amount);
}

export function addMonthsClamped(value, amount) {
  const [year, month, day] = value.split("-").map(Number);
  const targetIndex = year * 12 + month - 1 + amount;
  const targetYear = Math.floor(targetIndex / 12);
  const targetMonth = ((targetIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)))
    .toISOString().slice(0, 10);
}

export function addYearsClamped(value, amount) {
  return addMonthsClamped(value, amount * 12);
}

export function daysInclusive(start, end) {
  const difference = toEpochDay(end) - toEpochDay(start);
  if (difference < 0) throw new RangeError("Slutdatum måste vara samma dag eller senare än startdatum.");
  return difference + 1;
}

export function eachDateInclusive(start, end) {
  const length = daysInclusive(start, end);
  return Array.from({ length }, (_, index) => addDays(start, index));
}

export function rollingYearEnd(start) {
  const anniversary = addYearsClamped(start, 1);
  return start.endsWith("-02-29") ? anniversary : addDays(anniversary, -1);
}

export function todayLocalIso(now = new Date()) {
  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}
~~~

- [ ] **Step 4: Kör riktade tester**

Run: npm test -- test/dates.test.js

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

~~~bash
git add src/domain/dates.js test/dates.test.js
git commit -m "feat: add calendar-safe date utilities"
~~~

### Task 3: Profil- och vistelsevalidering samt immutabel state

**Files:**

- Create: src/domain/validation.js
- Create: src/domain/state.js
- Create: test/validation.test.js
- Create: test/state.test.js

- [ ] **Step 1: Skriv failing valideringstester**

Testa följande exakta kontrakt:

~~~js
const validProfile = {
  departureDate: "2025-05-10",
  budgetDays: 90,
  periodStart: "2026-01-01",
  periodEnd: "2026-12-31",
  swedishCitizen: "yes",
  livedInSwedenTenYears: "unanswered",
  connectionChecklist: {
    yearRoundHome: "no",
    spouseOrMinorChildren: "no",
    businessInSweden: "no",
    businessInfluence: "no",
    propertyInSweden: "no",
    otherStrongTies: "unanswered",
    workDuringStays: "no"
  }
};
~~~

Assertions:

- validateProfile(validProfile) returnerar ok true och en normaliserad kopia.
- budgetDays 0, decimal eller större än periodens kalenderdagar ger fieldErrors.budgetDays.
- periodEnd före periodStart ger fieldErrors.periodEnd.
- ogiltig tri-state ger fältnära fel.
- validateStayInput accepterar { arrivalDate, departureDate, status } och blockerar omvända datum eller status utanför actual och planned.

- [ ] **Step 2: Skriv failing state-tester**

Testa createEmptyState, setProfile, addStay, updateStay och removeStay. addStay ska ta injicerade { id, timestamp }, bevara tidigare state och skapa:

~~~js
{
  id: "stay-1",
  arrivalDate: "2026-08-01",
  departureDate: "2026-08-03",
  status: "planned",
  createdAt: "2026-08-16T12:00:00.000Z",
  updatedAt: "2026-08-16T12:00:00.000Z"
}
~~~

updateStay bevarar id och createdAt men ändrar updatedAt. Okänt id ska returnera { ok: false, message: "Vistelsen kunde inte hittas." }.

- [ ] **Step 3: Kör testerna och verifiera rött**

Run: npm test -- test/validation.test.js test/state.test.js

Expected: FAIL eftersom modulerna saknas.

- [ ] **Step 4: Implementera validering och state-API**

Implementera src/domain/validation.js med denna algoritm:

~~~js
import { daysInclusive, isIsoDate } from "./dates.js";

export const TRI_STATE = ["yes", "no", "unanswered"];
export const CHECKLIST_KEYS = [
  "yearRoundHome",
  "spouseOrMinorChildren",
  "businessInSweden",
  "businessInfluence",
  "propertyInSweden",
  "otherStrongTies",
  "workDuringStays"
];

function failed(fieldErrors, message = "Kontrollera de markerade fälten.") {
  return { ok: false, fieldErrors, message };
}

function normalizedTriState(value) {
  return value === undefined || value === null || value === ""
    ? "unanswered"
    : value;
}

export function validateProfile(input) {
  const fieldErrors = {};
  const departureDate = input?.departureDate;
  const periodStart = input?.periodStart;
  const periodEnd = input?.periodEnd;
  const budgetDays = Number(input?.budgetDays);

  if (!isIsoDate(departureDate)) fieldErrors.departureDate = "Ange ett giltigt utflyttningsdatum.";
  if (!isIsoDate(periodStart)) fieldErrors.periodStart = "Ange ett giltigt startdatum.";
  if (!isIsoDate(periodEnd)) fieldErrors.periodEnd = "Ange ett giltigt slutdatum.";

  let periodLength = null;
  if (isIsoDate(periodStart) && isIsoDate(periodEnd)) {
    if (periodEnd < periodStart) {
      fieldErrors.periodEnd = "Slutdatum måste vara samma dag eller senare än startdatum.";
    } else {
      periodLength = daysInclusive(periodStart, periodEnd);
    }
  }

  if (!Number.isInteger(budgetDays) || budgetDays < 1) {
    fieldErrors.budgetDays = "Dagbudgeten måste vara ett heltal på minst 1.";
  } else if (periodLength !== null && budgetDays > periodLength) {
    fieldErrors.budgetDays = "Dagbudgeten kan inte vara större än budgetperioden.";
  }

  const swedishCitizen = normalizedTriState(input?.swedishCitizen);
  const livedInSwedenTenYears = normalizedTriState(input?.livedInSwedenTenYears);
  if (!TRI_STATE.includes(swedishCitizen)) fieldErrors.swedishCitizen = "Välj ja, nej eller obesvarad.";
  if (!TRI_STATE.includes(livedInSwedenTenYears)) {
    fieldErrors.livedInSwedenTenYears = "Välj ja, nej eller obesvarad.";
  }

  const connectionChecklist = {};
  for (const key of CHECKLIST_KEYS) {
    const value = normalizedTriState(input?.connectionChecklist?.[key]);
    connectionChecklist[key] = value;
    if (!TRI_STATE.includes(value)) {
      fieldErrors["connectionChecklist." + key] = "Välj ja, nej eller obesvarad.";
    }
  }

  if (Object.keys(fieldErrors).length > 0) return failed(fieldErrors);
  return {
    ok: true,
    value: {
      departureDate,
      budgetDays,
      periodStart,
      periodEnd,
      swedishCitizen,
      livedInSwedenTenYears,
      connectionChecklist
    }
  };
}

export function validateStayInput(input) {
  const fieldErrors = {};
  const arrivalDate = input?.arrivalDate;
  const departureDate = input?.departureDate;
  const status = input?.status;
  if (!isIsoDate(arrivalDate)) fieldErrors.arrivalDate = "Ange ett giltigt ankomstdatum.";
  if (!isIsoDate(departureDate)) fieldErrors.departureDate = "Ange ett giltigt avresedatum.";
  if (isIsoDate(arrivalDate) && isIsoDate(departureDate) && departureDate < arrivalDate) {
    fieldErrors.departureDate = "Avresedatum måste vara samma dag eller senare än ankomstdatum.";
  }
  if (!["actual", "planned"].includes(status)) fieldErrors.status = "Välj faktisk eller planerad vistelse.";
  if (Object.keys(fieldErrors).length > 0) return failed(fieldErrors);
  return { ok: true, value: { arrivalDate, departureDate, status } };
}

export function validateAppState(input) {
  if (!input || input.version !== 1 || !Array.isArray(input.stays)) {
    return failed({}, "Den sparade datan har en version eller struktur som inte stöds.");
  }
  const profileResult = input.profile === null
    ? { ok: true, value: null }
    : validateProfile(input.profile);
  if (!profileResult.ok) return failed(profileResult.fieldErrors, "Den sparade profilen är ogiltig.");

  const stays = [];
  for (const candidate of input.stays) {
    const stayResult = validateStayInput(candidate);
    const validMetadata = typeof candidate?.id === "string" &&
      candidate.id.length > 0 &&
      !Number.isNaN(Date.parse(candidate.createdAt)) &&
      !Number.isNaN(Date.parse(candidate.updatedAt));
    if (!stayResult.ok || !validMetadata) return failed({}, "En sparad vistelse är ogiltig.");
    stays.push({
      id: candidate.id,
      ...stayResult.value,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt
    });
  }
  return { ok: true, value: { version: 1, profile: profileResult.value, stays } };
}
~~~

Implementera src/domain/state.js:

~~~js
import { validateProfile, validateStayInput } from "./validation.js";

export function createEmptyState() {
  return { version: 1, profile: null, stays: [] };
}

export function setProfile(state, input) {
  const result = validateProfile(input);
  return result.ok ? { ok: true, value: { ...state, profile: result.value } } : result;
}

export function addStay(state, input, { id, timestamp }) {
  const result = validateStayInput(input);
  if (!result.ok) return result;
  const stay = {
    id,
    ...result.value,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  return { ok: true, value: { ...state, stays: [...state.stays, stay] } };
}

export function updateStay(state, id, input, { timestamp }) {
  const current = state.stays.find((stay) => stay.id === id);
  if (!current) {
    return { ok: false, fieldErrors: {}, message: "Vistelsen kunde inte hittas." };
  }
  const result = validateStayInput(input);
  if (!result.ok) return result;
  const stays = state.stays.map((stay) => stay.id === id
    ? { ...current, ...result.value, updatedAt: timestamp }
    : stay);
  return { ok: true, value: { ...state, stays } };
}

export function removeStay(state, id) {
  if (!state.stays.some((stay) => stay.id === id)) {
    return { ok: false, fieldErrors: {}, message: "Vistelsen kunde inte hittas." };
  }
  return {
    ok: true,
    value: { ...state, stays: state.stays.filter((stay) => stay.id !== id) }
  };
}
~~~

- [ ] **Step 5: Verifiera och commit**

Run: npm test -- test/validation.test.js test/state.test.js

Expected: alla tester passar.

~~~bash
git add src/domain/validation.js src/domain/state.js test/validation.test.js test/state.test.js
git commit -m "feat: validate profiles and manage local state"
~~~

### Task 4: Vistelsemängder och personlig budget

**Files:**

- Create: src/domain/stays.js
- Create: src/domain/budget.js
- Create: test/stays.test.js
- Create: test/budget.test.js

- [ ] **Step 1: Skriv failing vistelsetester**

Använd faktisk 2026-01-01 till 2026-01-03 och planerad 2026-01-03 till 2026-01-05. Kräv:

- actualDays = 3,
- plannedDays = 3,
- uniqueDays = 5,
- statusByDate för 2026-01-03 är actual.

Testa även att 2025-12-30 till 2026-01-03 mot perioden 2026-01-01 till 2026-12-31 ger 3 inkluderade och 2 exkluderade unika datum. Direkt angränsande intervall ska kunna slås ihop för mönsteranalys.

- [ ] **Step 2: Skriv failing budgettester**

Med budget 5, faktisk 2026-08-01 till 2026-08-02 och planerad 2026-08-02 till 2026-08-06 ska calculateBudget returnera:

~~~js
{
  actualDays: 2,
  plannedDays: 5,
  uniqueDays: 6,
  remaining: -1,
  overBy: 1,
  lastWithinBudgetDate: "2026-08-05",
  firstExceededDate: "2026-08-06"
}
~~~

Testa också:

- total under budget ger null för båda gränsdatumen,
- redan fylld budget plus ny kandidat ger candidateLastWithinBudgetDate null och candidateFirstExceededDate lika med kandidatens första nya datum,
- redigering med excludeStayId tar bort den gamla vistelsen innan preview,
- datum utanför budgetperioden påverkar inte budgeten.

- [ ] **Step 3: Kör testerna och verifiera rött**

Run: npm test -- test/stays.test.js test/budget.test.js

Expected: FAIL eftersom modulerna saknas.

- [ ] **Step 4: Implementera rena mängd- och budgetfunktioner**

Implementera src/domain/stays.js:

~~~js
import { addDays, eachDateInclusive } from "./dates.js";

export function getStayDaySets(stays) {
  const actualDates = new Set();
  const plannedDates = new Set();
  for (const stay of stays) {
    const target = stay.status === "actual" ? actualDates : plannedDates;
    for (const date of eachDateInclusive(stay.arrivalDate, stay.departureDate)) {
      target.add(date);
    }
  }
  const uniqueDates = new Set([...actualDates, ...plannedDates]);
  const statusByDate = {};
  for (const date of uniqueDates) {
    statusByDate[date] = actualDates.has(date) ? "actual" : "planned";
  }
  return { actualDates, plannedDates, uniqueDates, statusByDate };
}

export function summarizePeriod(stays, periodStart, periodEnd) {
  const sets = getStayDaySets(stays);
  const inside = (date) => date >= periodStart && date <= periodEnd;
  const actual = [...sets.actualDates].filter(inside).sort();
  const planned = [...sets.plannedDates].filter(inside).sort();
  const registeredDates = [...sets.uniqueDates].filter(inside).sort();
  const excludedDates = [...sets.uniqueDates].filter((date) => !inside(date)).sort();
  return {
    actualDays: actual.length,
    plannedDays: planned.length,
    uniqueDays: registeredDates.length,
    excludedDays: excludedDates.length,
    registeredDates,
    excludedDates,
    statusByDate: sets.statusByDate
  };
}

export function mergeRegisteredIntervals(stays) {
  const sorted = stays
    .map(({ arrivalDate, departureDate }) => ({ arrivalDate, departureDate }))
    .sort((left, right) => left.arrivalDate.localeCompare(right.arrivalDate));
  const merged = [];
  for (const interval of sorted) {
    const current = merged.at(-1);
    if (!current || interval.arrivalDate > addDays(current.departureDate, 1)) {
      merged.push({ ...interval });
    } else if (interval.departureDate > current.departureDate) {
      current.departureDate = interval.departureDate;
    }
  }
  return merged;
}

export function getPastPlannedStays(stays, today) {
  return stays
    .filter((stay) => stay.status === "planned" && stay.departureDate < today)
    .sort((left, right) => left.departureDate.localeCompare(right.departureDate));
}
~~~

Implementera src/domain/budget.js:

~~~js
import { eachDateInclusive } from "./dates.js";
import { summarizePeriod } from "./stays.js";

export function calculateBudget(profile, stays) {
  const summary = summarizePeriod(stays, profile.periodStart, profile.periodEnd);
  const remaining = profile.budgetDays - summary.uniqueDays;
  return {
    ...summary,
    remaining,
    overBy: Math.max(0, -remaining),
    lastWithinBudgetDate: summary.uniqueDays >= profile.budgetDays
      ? summary.registeredDates[profile.budgetDays - 1]
      : null,
    firstExceededDate: summary.uniqueDays > profile.budgetDays
      ? summary.registeredDates[profile.budgetDays]
      : null
  };
}

export function evaluatePlannedStay(profile, stays, candidate, options = {}) {
  const baseStays = options.excludeStayId
    ? stays.filter((stay) => stay.id !== options.excludeStayId)
    : stays;
  const combinedStays = [...baseStays, { ...candidate, status: "planned" }];
  const result = calculateBudget(profile, combinedStays);
  const rankByDate = new Map(result.registeredDates.map((date, index) => [date, index + 1]));
  const candidateDates = eachDateInclusive(candidate.arrivalDate, candidate.departureDate)
    .filter((date) => date >= profile.periodStart && date <= profile.periodEnd);
  const candidateWithin = candidateDates.filter((date) => rankByDate.get(date) <= profile.budgetDays);
  const candidateOver = candidateDates.filter((date) => rankByDate.get(date) > profile.budgetDays);
  return {
    ...result,
    candidateLastWithinBudgetDate: candidateWithin.at(-1) ?? null,
    candidateFirstExceededDate: candidateOver[0] ?? null
  };
}
~~~

- [ ] **Step 5: Verifiera och commit**

Run: npm test -- test/stays.test.js test/budget.test.js

Expected: alla tester passar.

~~~bash
git add src/domain/stays.js src/domain/budget.js test/stays.test.js test/budget.test.js
git commit -m "feat: calculate registered days and personal budget"
~~~

### Task 5: Reproducerbara mönsterfakta

**Files:**

- Create: src/domain/patterns.js
- Create: test/patterns.test.js

- [ ] **Step 1: Skriv failing mönstertester**

Testa:

- 2026-01-01 till 2026-06-30 når inte sexmånadersdagen,
- 2026-01-01 till 2026-07-01 når sexmånadersdagen,
- 10 dagars vistelse, 5 oregistrerade dagar och 10 dagars vistelse skapar possibleTemporaryBreak,
- samma vistelser med 11 dagars mellanrum skapar ingen sådan rad,
- angränsande eller överlappande intervall slås ihop före gapberäkning,
- tolvmånadersfönstret 2025-03-01 till 2026-02-28 exkluderar 2026-03-01,
- maxRollingTwelveMonths returnerar både count, windowStart och windowEnd,
- visitStartDates och gapLengths returneras som fakta utan klassificering av periodicitet.

- [ ] **Step 2: Kör testet och verifiera rött**

Run: npm test -- test/patterns.test.js

Expected: FAIL med ERR_MODULE_NOT_FOUND.

- [ ] **Step 3: Implementera patterns-API**

Implementera src/domain/patterns.js:

~~~js
import {
  addDays,
  addMonthsClamped,
  daysInclusive,
  rollingYearEnd
} from "./dates.js";
import { getStayDaySets, mergeRegisteredIntervals } from "./stays.js";

export function getPossibleTemporaryBreaks(mergedIntervals) {
  const observations = [];
  for (let index = 0; index < mergedIntervals.length - 1; index += 1) {
    const before = mergedIntervals[index];
    const after = mergedIntervals[index + 1];
    const gapStart = addDays(before.departureDate, 1);
    const gapEnd = addDays(after.arrivalDate, -1);
    const gapDays = daysInclusive(gapStart, gapEnd);
    const beforeDays = daysInclusive(before.arrivalDate, before.departureDate);
    const afterDays = daysInclusive(after.arrivalDate, after.departureDate);
    if (gapDays <= beforeDays && gapDays <= afterDays) {
      observations.push({
        before,
        after,
        gapStart,
        gapEnd,
        gapDays,
        beforeDays,
        afterDays
      });
    }
  }
  return observations;
}

export function getSixMonthStays(mergedIntervals) {
  return mergedIntervals
    .map((interval) => ({
      ...interval,
      sixMonthDate: addMonthsClamped(interval.arrivalDate, 6)
    }))
    .filter((interval) => interval.departureDate >= interval.sixMonthDate);
}

export function maxRollingTwelveMonthDays(stays) {
  const dates = [...getStayDaySets(stays).uniqueDates].sort();
  let best = { count: 0, windowStart: null, windowEnd: null };
  for (const windowStart of dates) {
    const windowEnd = rollingYearEnd(windowStart);
    const count = dates.filter((date) => date >= windowStart && date <= windowEnd).length;
    if (count > best.count) best = { count, windowStart, windowEnd };
  }
  return best;
}

export function calculatePatternFacts(stays) {
  const mergedIntervals = mergeRegisteredIntervals(stays);
  const lengths = mergedIntervals.map((interval) =>
    daysInclusive(interval.arrivalDate, interval.departureDate));
  const gaps = mergedIntervals.slice(0, -1).map((interval, index) => {
    const next = mergedIntervals[index + 1];
    return daysInclusive(addDays(interval.departureDate, 1), addDays(next.arrivalDate, -1));
  });
  return {
    mergedIntervals,
    visitCount: mergedIntervals.length,
    totalDays: lengths.reduce((sum, value) => sum + value, 0),
    longestStayDays: lengths.length === 0 ? 0 : Math.max(...lengths),
    visitStartDates: mergedIntervals.map((interval) => interval.arrivalDate),
    gapLengths: gaps,
    sixMonthStays: getSixMonthStays(mergedIntervals),
    possibleTemporaryBreaks: getPossibleTemporaryBreaks(mergedIntervals),
    maxRollingTwelveMonths: maxRollingTwelveMonthDays(stays)
  };
}
~~~

För tom input ska calculatePatternFacts returnera:

~~~js
{
  mergedIntervals: [],
  visitCount: 0,
  totalDays: 0,
  longestStayDays: 0,
  visitStartDates: [],
  gapLengths: [],
  sixMonthStays: [],
  possibleTemporaryBreaks: [],
  maxRollingTwelveMonths: {
    count: 0,
    windowStart: null,
    windowEnd: null
  }
}
~~~

Använd addMonthsClamped för sexmånadersdagen och rollingYearEnd för fönsterslutet. Funktionen beskriver registrerade eller oregistrerade datum; den kallar aldrig en vistelse stadigvarande.

- [ ] **Step 4: Verifiera och commit**

Run: npm test -- test/patterns.test.js

Expected: alla tester passar.

~~~bash
git add src/domain/patterns.js test/patterns.test.js
git commit -m "feat: derive transparent stay pattern facts"
~~~

### Task 6: Juridisk källcopy och observationer

**Files:**

- Create: src/legal-content.js
- Create: src/domain/observations.js
- Create: test/observations.test.js

- [ ] **Step 1: Skriv failing observationstester**

Kräv att:

- svensk medborgare eller tio års tidigare bosättning ger en five-year-evidence-observation med femårsdagen,
- no och unanswered inte skapar en anknytningsobservation,
- varje yes-värde i checklistan skapar en egen observation med exakt field key,
- actual-mönster har scope actual,
- ett mönster som endast uppstår när planerade intervall läggs till har scope scenario och copy som börjar med "Om planen genomförs",
- arbete under vistelser visar actual och combined maxRollingTwelveMonths men säger att 183 dagar inte är en generell safe harbour,
- varje observation har evidence, sourceId och reviewedAt,
- ingen output innehåller orden "lagligt", "olagligt" eller "juridiskt säker".

- [ ] **Step 2: Kör testet och verifiera rött**

Run: npm test -- test/observations.test.js

Expected: FAIL eftersom modulerna saknas.

- [ ] **Step 3: Implementera källmetadata**

src/legal-content.js ska exportera LEGAL_SOURCES med dessa stabila ids:

~~~js
export const LEGAL_SOURCES = {
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
};

export const CHECKLIST_CONTENT = {
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
};
~~~

- [ ] **Step 4: Implementera observationsmotorn**

Implementera src/domain/observations.js:

~~~js
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

export function buildObservations(profile, stays) {
  const actualStays = stays.filter((stay) => stay.status === "actual");
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
      evidence: [
        "Utflyttningsdatum " + profile.departureDate,
        "Femårsdag " + addYearsClamped(profile.departureDate, 5)
      ],
      sourceId: "incomeTaxAct"
    }));
  }

  for (const [key, value] of Object.entries(profile.connectionChecklist)) {
    if (value !== "yes" || key === "workDuringStays") continue;
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
  const actualPatternKeys = new Set(actualPatternRows.map((row) =>
    row.title + "|" + row.evidence.join("|")));
  observations.push(...patternObservations(combinedFacts, "scenario").filter((row) =>
    !actualPatternKeys.has(row.title + "|" + row.evidence.join("|"))));

  if (profile.connectionChecklist.workDuringStays === "yes") {
    observations.push(createObservation({
      id: "work-rolling-window",
      level: "info",
      title: "Arbete under Sverigebesök",
      summary: "183 dagar är inte en generell safe harbour och övriga villkor måste bedömas.",
      evidence: [
        "Faktisk historik: högst " + actualFacts.maxRollingTwelveMonths.count +
          " registrerade dagar i ett tolvmånadersfönster",
        "Faktisk plus planerad: högst " + combinedFacts.maxRollingTwelveMonths.count +
          " registrerade dagar i ett tolvmånadersfönster"
      ],
      sourceId: "sink183"
    }));
  }

  const levelOrder = { review: 0, info: 1 };
  const scopeOrder = { actual: 0, scenario: 1 };
  return observations.sort((left, right) =>
    levelOrder[left.level] - levelOrder[right.level] ||
    scopeOrder[left.scope] - scopeOrder[right.scope] ||
    left.id.localeCompare(right.id));
}
~~~

- [ ] **Step 5: Verifiera och commit**

Run: npm test -- test/observations.test.js

Expected: alla tester passar och ordskyddet är grönt.

~~~bash
git add src/legal-content.js src/domain/observations.js test/observations.test.js
git commit -m "feat: add source-backed legal observations"
~~~

### Task 7: Versionsmärkt lokal lagring och fallback

**Files:**

- Create: src/storage.js
- Create: test/storage.test.js

- [ ] **Step 1: Skriv failing repository-tester**

Skapa små fake storage-objekt med getItem, setItem och removeItem. Testa:

- saknad nyckel ger { state: null, issue: null },
- giltig v1 laddas,
- invalid JSON, fel schema, version 0 och version 2 kraschar inte,
- okänd version ligger kvar orörd,
- localStorage.setItem som kastar faller tillbaka till sessionStorage,
- både localStorage och sessionStorage som kastar faller tillbaka till minne,
- mode och persistent warning följer med varje resultat,
- clear tar endast bort sverigevistelseplanerare:state:v1 och lämnar främmande nycklar,
- serialisering whitelistar modellen så income, passport och notes aldrig skrivs.

- [ ] **Step 2: Kör testet och verifiera rött**

Run: npm test -- test/storage.test.js

Expected: FAIL med ERR_MODULE_NOT_FOUND.

- [ ] **Step 3: Implementera repository-kontraktet**

Implementera src/storage.js med detta kontrakt och fallbackflöde:

~~~js
import { validateAppState } from "./domain/validation.js";

export const STORAGE_KEY = "sverigevistelseplanerare:state:v1";

function issue(code, message) {
  return { code, message };
}

export function decodeStoredState(raw) {
  if (raw === null) return { ok: true, state: null, issue: null };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      state: null,
      issue: issue("invalid-json", "Sparad data kunde inte läsas. Rensa den för att börja om.")
    };
  }
  if (parsed?.version !== 1) {
    return {
      ok: false,
      state: null,
      issue: issue("unsupported-version", "Den sparade dataversionen stöds inte. Datan har inte skrivits över.")
    };
  }
  const result = validateAppState(parsed);
  return result.ok
    ? { ok: true, state: result.value, issue: null }
    : {
        ok: false,
        state: null,
        issue: issue("invalid-state", "Sparad data har en ogiltig struktur. Rensa den för att börja om.")
      };
}

export function serializeAppState(state) {
  if (state?.demo === true) throw new TypeError("Demoexemplet får inte sparas.");
  const result = validateAppState(state);
  if (!result.ok) throw new TypeError(result.message);
  return JSON.stringify(result.value);
}

export function createStateRepository({
  localStorage = null,
  sessionStorage = null
} = {}) {
  let mode = "local";
  let memoryRaw = null;
  let locked = false;

  function read(storage) {
    if (!storage) return { accessible: false, raw: null };
    try {
      return { accessible: true, raw: storage.getItem(STORAGE_KEY) };
    } catch {
      return { accessible: false, raw: null };
    }
  }

  function load() {
    const local = read(localStorage);
    const session = local.raw === null ? read(sessionStorage) : { accessible: false, raw: null };
    let raw = memoryRaw;
    if (local.raw !== null) {
      raw = local.raw;
      mode = "local";
    } else if (session.raw !== null) {
      raw = session.raw;
      mode = "session";
    } else if (local.accessible) {
      mode = "local";
    } else if (session.accessible) {
      mode = "session";
    } else {
      mode = "memory";
    }
    if (raw === null) return { state: null, issue: null, mode };
    const decoded = decodeStoredState(raw);
    locked = !decoded.ok;
    return { state: decoded.state, issue: decoded.issue, mode };
  }

  function tryWrite(storage, nextMode, raw) {
    if (!storage) return false;
    try {
      storage.setItem(STORAGE_KEY, raw);
      mode = nextMode;
      return true;
    } catch {
      return false;
    }
  }

  function save(state) {
    if (locked) {
      return {
        ok: false,
        issue: issue("clear-required", "Rensa den inkompatibla datan innan en ny profil sparas."),
        mode
      };
    }
    let raw;
    try {
      raw = serializeAppState(state);
    } catch (error) {
      return { ok: false, issue: issue("invalid-state", error.message), mode };
    }
    if (tryWrite(localStorage, "local", raw)) return { ok: true, issue: null, mode };
    if (tryWrite(sessionStorage, "session", raw)) {
      return {
        ok: true,
        issue: issue("session-fallback", "Data kan försvinna när sidan stängs."),
        mode
      };
    }
    memoryRaw = raw;
    mode = "memory";
    return {
      ok: true,
      issue: issue("memory-fallback", "Data försvinner när sidan laddas om."),
      mode
    };
  }

  function clear() {
    for (const storage of [localStorage, sessionStorage]) {
      try {
        storage?.removeItem(STORAGE_KEY);
      } catch {
        // Rensning fortsätter i övriga tillgängliga lager.
      }
    }
    memoryRaw = null;
    locked = false;
    const localAvailable = read(localStorage).accessible;
    const sessionAvailable = read(sessionStorage).accessible;
    mode = localAvailable ? "local" : sessionAvailable ? "session" : "memory";
    return { ok: true, issue: null, mode };
  }

  return {
    load,
    save,
    clear,
    get mode() {
      return mode;
    }
  };
}
~~~

Testet ska dessutom verifiera att kommentaren i clear inte ersätts av loggning. Repositoryn får aldrig lägga state eller serialiserad data i ett felmeddelande.

- [ ] **Step 4: Verifiera och commit**

Run: npm test -- test/storage.test.js

Expected: alla tester passar.

~~~bash
git add src/storage.js test/storage.test.js
git commit -m "feat: persist versioned state with safe fallback"
~~~

### Task 8: Onboarding och temporärt demoexempel

**Files:**

- Create: src/demo-state.js
- Create: src/ui/onboarding.js
- Create: test/ui.test.js
- Modify: styles.css

- [ ] **Step 1: Skriv failing onboarding-tester**

Testa att renderOnboarding:

- innehåller "Planeringsverktyg, inte juridisk rådgivning",
- har labels för utflyttningsdatum, dagbudget och budgetperiod,
- har alla frivilliga checklistesvar,
- återger fieldErrors med aria-invalid och aria-describedby,
- visar session- eller memory-varning utan resedatum,
- har knapp för syntetiskt demoexempel.

Testa createDemoState("2026-08-16") med fasta datum och demo: true. Verifiera att demo-state aldrig accepteras av serializeAppState.

- [ ] **Step 2: Kör testet och verifiera rött**

Run: npm test -- test/ui.test.js

Expected: FAIL eftersom onboarding- och demomodulerna saknas.

- [ ] **Step 3: Implementera onboarding**

Implementera src/demo-state.js:

~~~js
import { CHECKLIST_KEYS } from "./domain/validation.js";

export function createDemoState(today) {
  const year = today.slice(0, 4);
  const unanswered = Object.fromEntries(CHECKLIST_KEYS.map((key) => [key, "unanswered"]));
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
~~~

Implementera src/ui/onboarding.js enligt denna struktur:

~~~js
import { CHECKLIST_CONTENT } from "../legal-content.js";
import { CHECKLIST_KEYS } from "../domain/validation.js";

function errorFor(errors, key) {
  const message = errors?.[key];
  return message ? '<p class="field-error" id="' + key + '-error">' + message + "</p>" : "";
}

function errorAttributes(errors, key) {
  return errors?.[key]
    ? ' aria-invalid="true" aria-describedby="' + key + '-error"'
    : "";
}

function triState(name, value = "unanswered") {
  return ["yes", "no", "unanswered"].map((option) => {
    const label = option === "yes" ? "Ja" : option === "no" ? "Nej" : "Vill inte svara nu";
    const checked = value === option ? " checked" : "";
    return '<label><input type="radio" name="' + name + '" value="' + option + '"' +
      checked + "> " + label + "</label>";
  }).join("");
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
  const errorSummary = Object.values(fieldErrors).length > 0
    ? '<div class="error-summary" role="alert"><h2>Kontrollera uppgifterna</h2><p>' +
      Object.values(fieldErrors).join(" ") + "</p></div>"
    : "";
  const storageBanner = storageIssue
    ? '<p class="storage-warning" role="status">' + storageIssue.message + "</p>"
    : "";
  const checklist = CHECKLIST_KEYS.map((key) => {
    const name = "connectionChecklist." + key;
    return '<fieldset><legend>' + CHECKLIST_CONTENT[key].label + "</legend>" +
      triState(name, defaults.connectionChecklist?.[key]) +
      errorFor(fieldErrors, name) + "</fieldset>";
  }).join("");

  return '<section class="onboarding">' +
    '<p class="eyebrow">Sverigevistelseplaneraren</p>' +
    "<h1>" + (editing ? "Ändra din plan" : "Planera Sverigedagar med tydliga antaganden") + "</h1>" +
    '<p class="disclaimer">Planeringsverktyg, inte juridisk rådgivning. Ett grönt budgetläge är inte ett juridiskt besked.</p>' +
    storageBanner + errorSummary +
    '<form data-form="profile" novalidate>' +
    '<label for="departureDate">Utflyttningsdatum</label>' +
    '<input id="departureDate" name="departureDate" type="date" value="' + defaults.departureDate + '"' +
    errorAttributes(fieldErrors, "departureDate") + ">" + errorFor(fieldErrors, "departureDate") +
    '<label for="budgetDays">Personlig dagbudget</label>' +
    '<input id="budgetDays" name="budgetDays" type="number" min="1" step="1" value="' +
    defaults.budgetDays + '"' + errorAttributes(fieldErrors, "budgetDays") + ">" +
    errorFor(fieldErrors, "budgetDays") +
    '<div class="date-pair"><div><label for="periodStart">Period från</label>' +
    '<input id="periodStart" name="periodStart" type="date" value="' + defaults.periodStart + '"' +
    errorAttributes(fieldErrors, "periodStart") + ">" + errorFor(fieldErrors, "periodStart") +
    '</div><div><label for="periodEnd">Period till</label>' +
    '<input id="periodEnd" name="periodEnd" type="date" value="' + defaults.periodEnd + '"' +
    errorAttributes(fieldErrors, "periodEnd") + ">" + errorFor(fieldErrors, "periodEnd") + "</div></div>" +
    '<details><summary>Frivilliga frågor för juridiska observationer</summary>' +
    '<fieldset><legend>Är du svensk medborgare?</legend>' +
    triState("swedishCitizen", defaults.swedishCitizen) + "</fieldset>" +
    '<fieldset><legend>Har du bott eller stadigvarande vistats i Sverige i minst tio år?</legend>' +
    triState("livedInSwedenTenYears", defaults.livedInSwedenTenYears) + "</fieldset>" +
    checklist + "</details>" +
    '<div class="form-actions"><button type="submit">' +
    (editing ? "Spara ändringar" : "Skapa min plan") + "</button>" +
    (editing ? '<button type="button" data-action="cancel-edit-profile">Avbryt</button>' : "") +
    "</div></form>" +
    (editing ? "" : '<button class="text-button" type="button" data-action="show-demo">Visa syntetiskt demoexempel</button>') +
    "</section>";
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
~~~

Markup använder ett riktigt form-element, fieldset för tri-state-frågorna, fältnära fel, en errorsummary med role alert och separata actions save-profile och show-demo. Controller får endast anropa show-demo när inget riktigt state är i redigeringsläge.

- [ ] **Step 4: Lägg minsta onboarding-styling**

Lägg till tokens för bakgrund, text, blå faktisk, ljusblå planerad, amber observation, röd validering, ytor, radie och skugga. Formfält ska ha minst 44 px höjd och synlig focus-visible.

- [ ] **Step 5: Verifiera och commit**

Run: npm test -- test/ui.test.js

Expected: onboarding-testerna passar.

~~~bash
git add src/demo-state.js src/ui/onboarding.js styles.css test/ui.test.js
git commit -m "feat: add local-first onboarding and safe demo"
~~~

### Task 9: Kalendercockpit och juridisk panel

**Files:**

- Create: src/ui/cockpit.js
- Create: src/ui/observations.js
- Modify: test/ui.test.js
- Modify: styles.css

- [ ] **Step 1: Skriv failing cockpit-tester**

Bygg en viewmodel med period augusti 2026, budget 5, faktisk 1 till 2 augusti och planerad 2 till 6 augusti. Kräv:

- KPI: 2 faktiska, 5 planerade, 6 unika, 1 över budget,
- texten "Senaste registrerade dag inom budget: 5 augusti 2026",
- faktisk markör har presentationsföreträde 2 augusti,
- legend och synlig text skiljer actual och planned utan enbart färg,
- tom state säger "Inga Sverigedagar registrerade",
- passerad planerad vistelse får action confirm-actual,
- varje juridiskt kort visar evidence, source title, länk och reviewedAt,
- exkluderade datum redovisas neutralt,
- demo visar exit-demo men inga add-, edit-, confirm- eller clear-actions.

- [ ] **Step 2: Kör testet och verifiera rött**

Run: npm test -- test/ui.test.js

Expected: FAIL på de nya cockpit-assertionerna.

- [ ] **Step 3: Implementera cockpit-rendering**

Implementera src/ui/observations.js:

~~~js
export function renderObservations(observations, legalSources) {
  if (observations.length === 0) {
    return '<p class="empty-observations">Inga observationer från dina registrerade uppgifter.</p>';
  }
  return observations.map((observation) => {
    const source = legalSources[observation.sourceId];
    const scope = observation.scope === "scenario" ? "Planerat scenario" : "Registrerad historik";
    const evidence = observation.evidence.map((item) => "<li>" + item + "</li>").join("");
    return '<article class="observation observation--' + observation.level + '">' +
      '<p class="observation__scope">' + scope + "</p>" +
      "<h3>" + observation.title + "</h3>" +
      "<p>" + observation.summary + "</p>" +
      '<ul class="observation__evidence">' + evidence + "</ul>" +
      '<a href="' + source.url + '" target="_blank" rel="noreferrer">' + source.title + "</a>" +
      '<p class="source-date">Senast granskad ' + source.reviewedAt + "</p>" +
      "</article>";
  }).join("");
}
~~~

Implementera src/ui/cockpit.js. Denna kod visar den låsta datasammansättningen och de semantiska hooks som testerna ska kräva:

~~~js
import { calculateBudget } from "../domain/budget.js";
import { getPastPlannedStays } from "../domain/stays.js";
import { buildObservations } from "../domain/observations.js";
import { LEGAL_SOURCES } from "../legal-content.js";
import { renderObservations } from "./observations.js";

const MONTHS = [
  "Januari", "Februari", "Mars", "April", "Maj", "Juni",
  "Juli", "Augusti", "September", "Oktober", "November", "December"
];
const WEEKDAYS = ["M", "T", "O", "T", "F", "L", "S"];

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

export function buildCockpitModel(state, {
  today,
  year = Number(state.profile.periodStart.slice(0, 4)),
  focusedDate = null,
  storageIssue = null,
  demo = false
}) {
  const budget = calculateBudget(state.profile, state.stays);
  const firstDateOfYear = iso(year, 1, 1);
  const focus = focusedDate ?? (today.startsWith(String(year)) ? today : firstDateOfYear);
  return {
    profile: state.profile,
    stays: [...state.stays].sort((left, right) =>
      left.arrivalDate.localeCompare(right.arrivalDate)),
    budget,
    observations: buildObservations(state.profile, state.stays),
    pastPlanned: getPastPlannedStays(state.stays, today),
    statusByDate: budget.statusByDate,
    year,
    focusedDate: focus,
    storageIssue,
    demo
  };
}

function renderMonth(model, month) {
  const days = new Date(Date.UTC(model.year, month, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(model.year, month - 1, 1)).getUTCDay() + 6) % 7;
  const cells = Array.from({ length: firstWeekday }, () => '<td aria-hidden="true"></td>');
  for (let day = 1; day <= days; day += 1) {
    const date = iso(model.year, month, day);
    const status = model.statusByDate[date] ?? "unregistered";
    const statusLabel = status === "actual"
      ? "faktisk vistelse"
      : status === "planned"
        ? "planerad vistelse"
        : "inte registrerad";
    const tabindex = date === model.focusedDate ? "0" : "-1";
    const action = model.demo ? "demo-date" : "select-date";
    const disabled = model.demo ? ' aria-disabled="true"' : "";
    cells.push('<td><button class="calendar-day calendar-day--' + status +
      '" type="button" data-action="' + action + '" data-date="' + date +
      '" data-status="' + status + '" tabindex="' + tabindex +
      '" aria-label="' + formatDate(date) + ", " + statusLabel + '"' + disabled + ">" +
      day + "</button></td>");
  }
  while (cells.length % 7 !== 0) cells.push('<td aria-hidden="true"></td>');
  const rows = [];
  for (let index = 0; index < cells.length; index += 7) {
    rows.push("<tr>" + cells.slice(index, index + 7).join("") + "</tr>");
  }
  return '<section class="month-card"><h3>' + MONTHS[month - 1] + "</h3>" +
    '<table><thead><tr>' + WEEKDAYS.map((day) => "<th scope=\"col\">" + day + "</th>").join("") +
    '</tr></thead><tbody>' + rows.join("") + "</tbody></table></section>";
}

export function renderYearCalendar(model) {
  return '<div class="year-calendar" aria-label="Årskalender ' + model.year + '">' +
    Array.from({ length: 12 }, (_, index) => renderMonth(model, index + 1)).join("") +
    "</div>";
}

function renderStayList(model) {
  if (model.stays.length === 0) {
    return '<div class="empty-state"><h2>Inga Sverigedagar registrerade</h2>' +
      "<p>Omarkerade dagar är inte registrerade och bevisar inte utlandsvistelse.</p>" +
      '<button type="button" data-action="add-stay">Lägg till första vistelsen</button></div>';
  }
  return '<ul class="stay-list">' + model.stays.map((stay) => {
    if (model.demo) {
      return '<li class="stay-row"><span>' + formatDate(stay.arrivalDate) + "–" +
        formatDate(stay.departureDate) + '</span><span class="status-label">' +
        (stay.status === "actual" ? "Faktisk" : "Planerad") + "</span></li>";
    }
    const pastAction = model.pastPlanned.some((item) => item.id === stay.id)
      ? '<button type="button" data-action="confirm-actual" data-stay-id="' + stay.id +
        '">Markera som genomförd</button>'
      : "";
    return '<li><button class="stay-row" type="button" data-action="edit-stay" data-stay-id="' +
      stay.id + '"><span>' + formatDate(stay.arrivalDate) + "–" +
      formatDate(stay.departureDate) + '</span><span class="status-label">' +
      (stay.status === "actual" ? "Faktisk" : "Planerad") + "</span></button>" +
      pastAction + "</li>";
  }).join("") + "</ul>";
}

export function renderCockpit(model) {
  const budgetCopy = model.budget.overBy > 0
    ? "Planen ligger " + model.budget.overBy + " dagar över din personliga budget"
    : model.budget.remaining + " dagar kvar i din personliga budget";
  const boundary = model.budget.lastWithinBudgetDate
    ? "<p>Senaste registrerade dag inom budget: " +
      formatDate(model.budget.lastWithinBudgetDate) + "</p>"
    : "<p>Ingen budgetgräns nås av den registrerade planen.</p>";
  const headerActions = model.demo
    ? '<button type="button" data-action="exit-demo">Tillbaka till min plan</button>'
    : '<button type="button" data-action="edit-profile">Inställningar</button>' +
      '<button type="button" data-action="add-stay">Lägg till vistelse</button>';
  return (model.demo ? '<div class="demo-banner">Syntetiskt demoexempel — sparas inte</div>' : "") +
    (model.storageIssue ? '<div class="storage-warning" role="status">' +
      model.storageIssue.message + "</div>" : "") +
    '<header class="app-header"><div><p class="eyebrow">Sverigevistelseplaneraren</p>' +
    "<h1>Din Sverigeöversikt</h1></div>" +
    '<div class="header-actions">' + headerActions + "</div></header>" +
    '<section class="summary-grid" aria-label="Dagsammanställning">' +
    '<article><strong>' + model.budget.actualDays + "</strong><span>Faktiska dagar</span></article>" +
    '<article><strong>' + model.budget.plannedDays + "</strong><span>Planerade dagar</span></article>" +
    '<article><strong>' + model.budget.uniqueDays + "</strong><span>Unika dagar totalt</span></article>" +
    '<article><strong>' + model.profile.budgetDays + "</strong><span>Personlig budget</span></article>" +
    "</section><section class=\"budget-status\"><h2>" + budgetCopy + "</h2>" + boundary +
    (model.budget.excludedDays > 0
      ? "<p>" + model.budget.excludedDays + " registrerade dagar ligger utanför budgetperioden och räknas inte.</p>"
      : "") + "</section>" +
    '<div class="legend"><span class="legend--actual">Faktisk</span>' +
    '<span class="legend--planned">Planerad</span><span>Inte registrerad</span></div>' +
    '<div class="cockpit-layout"><section><div class="year-nav">' +
    '<button type="button" data-action="previous-year" aria-label="Föregående år">←</button>' +
    "<h2>" + model.year + "</h2>" +
    '<button type="button" data-action="next-year" aria-label="Nästa år">→</button></div>' +
    renderYearCalendar(model) + "</section><aside><section><h2>Vistelser</h2>" +
    renderStayList(model) + '</section><section><h2>Juridiska observationer</h2>' +
    renderObservations(model.observations, LEGAL_SOURCES) + "</section></aside></div>" +
    (model.demo ? "" :
      '<footer><button class="danger-text" type="button" data-action="request-clear">Rensa all data</button></footer>');
}
~~~

buildCockpitModel är enda UI-adaptern från state till budget, statusByDate, passerade planer och observationer. Testa att varje månadstabell får sju kolumnrubriker och att tabindex 0 förekommer exakt en gång i hela årskalendern.

- [ ] **Step 4: Implementera responsiv cockpit-styling**

Desktop visar kalender och sidopanel. Månadsgallret använder tre kolumner över 980 px, två mellan 640 och 979 px och en under 640 px. Status skiljs med färg, label i accessible name och formmarkör. KPI-kort får neutral copy; rött reserveras för valideringsfel och inte för juridiska slutsatser.

- [ ] **Step 5: Verifiera och commit**

Run: npm test -- test/ui.test.js

Expected: alla UI-tester passar.

~~~bash
git add src/ui/cockpit.js src/ui/observations.js styles.css test/ui.test.js
git commit -m "feat: render accessible calendar cockpit"
~~~

### Task 10: Vistelsedialog, controller och CRUD

**Files:**

- Create: src/ui/stay-dialog.js
- Create: src/controller.js
- Create: test/controller.test.js
- Modify: src/main.js
- Modify: test/ui.test.js

- [ ] **Step 1: Skriv failing dialog- och controllertester**

Testa renderStayDialog för create, edit, valideringsfel och explicit delete confirmation. Testa controller med fake repository och fake render:

- init laddar state och väljer onboarding eller cockpit,
- saveProfile validerar, sparar och renderar,
- addStay, updateStay och removeStay muterar via state-modulen,
- update preview exkluderar gammalt intervall,
- confirmPastPlanned ändrar endast vald vistelse till actual,
- showDemo visar temporär state utan repository.save,
- exitDemo återgår till riktig state eller onboarding,
- clearAll kräver explicit confirmed true och återgår till onboarding,
- storage issue ligger kvar efter omrendering.

- [ ] **Step 2: Kör testet och verifiera rött**

Run: npm test -- test/controller.test.js test/ui.test.js

Expected: FAIL eftersom controller och dialog saknas.

- [ ] **Step 3: Implementera controller-API**

Implementera src/controller.js:

~~~js
import {
  addStay,
  createEmptyState,
  removeStay as removeStayFromState,
  setProfile,
  updateStay
} from "./domain/state.js";
import { createDemoState } from "./demo-state.js";

export function createAppController({
  repository,
  render,
  makeId,
  now,
  today
}) {
  let state = null;
  let storageIssue = null;
  let demoState = null;
  let editingProfile = false;

  function publish() {
    render({
      state: demoState ?? state,
      storageIssue,
      demo: demoState !== null,
      editingProfile,
      today
    });
  }

  function result(ok, message = "", fieldErrors = {}) {
    return { ok, message, fieldErrors };
  }

  function persist(nextState, message) {
    const saved = repository.save(nextState);
    storageIssue = saved.issue;
    if (!saved.ok) {
      publish();
      return result(false, saved.issue?.message ?? "Datan kunde inte sparas.");
    }
    state = nextState;
    demoState = null;
    editingProfile = false;
    publish();
    return result(true, message);
  }

  function init() {
    const loaded = repository.load();
    state = loaded.state;
    storageIssue = loaded.issue;
    publish();
    return result(true);
  }

  function saveProfile(input) {
    const base = state ?? createEmptyState();
    const changed = setProfile(base, input);
    return changed.ok
      ? persist(changed.value, "Din plan har sparats.")
      : result(false, changed.message, changed.fieldErrors);
  }

  function saveStay(input, id = null) {
    if (!state?.profile) return result(false, "Skapa en profil innan du lägger till vistelser.");
    const metadata = { id: id ?? makeId(), timestamp: now() };
    const changed = id
      ? updateStay(state, id, input, metadata)
      : addStay(state, input, metadata);
    return changed.ok
      ? persist(changed.value, id ? "Vistelsen har uppdaterats." : "Vistelsen har lagts till.")
      : result(false, changed.message, changed.fieldErrors);
  }

  function removeStay(id) {
    if (!state) return result(false, "Vistelsen kunde inte hittas.");
    const changed = removeStayFromState(state, id);
    return changed.ok
      ? persist(changed.value, "Vistelsen har tagits bort.")
      : result(false, changed.message, changed.fieldErrors);
  }

  function confirmPastPlanned(id) {
    const current = state?.stays.find((stay) => stay.id === id);
    if (!current) return result(false, "Vistelsen kunde inte hittas.");
    return saveStay({
      arrivalDate: current.arrivalDate,
      departureDate: current.departureDate,
      status: "actual"
    }, id);
  }

  function showDemo() {
    if (state?.profile) return result(false, "Demo kan bara öppnas innan en egen plan har skapats.");
    demoState = createDemoState(today);
    publish();
    return result(true);
  }

  function exitDemo() {
    demoState = null;
    publish();
    return result(true);
  }

  function beginEditProfile() {
    editingProfile = true;
    publish();
    return result(true);
  }

  function cancelEditProfile() {
    editingProfile = false;
    publish();
    return result(true);
  }

  function clearAll({ confirmed = false } = {}) {
    if (!confirmed) return result(false, "Bekräfta att profilen och alla vistelser ska tas bort.");
    const cleared = repository.clear();
    if (!cleared.ok) return result(false, cleared.issue?.message ?? "Datan kunde inte rensas.");
    state = null;
    demoState = null;
    storageIssue = null;
    editingProfile = false;
    publish();
    return result(true, "All lokal appdata har rensats.");
  }

  function getSnapshot() {
    return {
      state,
      storageIssue,
      demo: demoState !== null,
      editingProfile,
      today
    };
  }

  return {
    init,
    saveProfile,
    saveStay,
    removeStay,
    confirmPastPlanned,
    showDemo,
    exitDemo,
    beginEditProfile,
    cancelEditProfile,
    clearAll,
    getSnapshot
  };
}
~~~

now injiceras som en funktion som returnerar en ISO-timestamp och today som lokal YYYY-MM-DD. I failure-grenarna för saveStay ska main.js återöppna dialogen med fieldErrors; controller behöver därför inte publicera en ny dashboard där. Controller får inte använda alert, confirm, console eller direkt DOM.

- [ ] **Step 4: Implementera dialog och browserbindning**

ui/stay-dialog.js ska exportera renderStayDialog(model), openStayDialog(dialog, model, returnFocusElement), closeStayDialog(dialog) och readStayForm(form). openStayDialog sätter dialog.innerHTML från renderStayDialog, anropar showModal och fokuserar ankomstfältet. closeStayDialog stänger dialogen och återställer fokus till returnFocusElement. Delete visar först en inline-bekräftelse med actions request-delete och confirm-delete.

src/main.js ska:

- skapa repository med säkert inhämtad window.localStorage och window.sessionStorage,
- injicera lokalt today och crypto.randomUUID,
- rendera onboarding eller cockpit,
- äga endast presentationsstate för viewYear, focusedDate och aktuell dialog; controller äger all persistent state,
- delegera submit och click via data-action,
- implementera roving focus: ArrowLeft och ArrowRight flyttar en dag, ArrowUp och ArrowDown sju dagar,
- öppna vistelsedialog med Enter eller klick,
- uppdatera live-region med neutrala sparmeddelanden,
- aldrig logga profil eller datum.

- [ ] **Step 5: Verifiera och commit**

Run: npm test -- test/controller.test.js test/ui.test.js

Expected: alla tester passar.

~~~bash
git add src/controller.js src/main.js src/ui/stay-dialog.js test/controller.test.js test/ui.test.js
git commit -m "feat: wire profile and stay interactions"
~~~

### Task 11: Inställningar, tomlägen och destruktiva bekräftelser

**Files:**

- Modify: src/ui/onboarding.js
- Modify: src/ui/cockpit.js
- Modify: src/controller.js
- Modify: src/main.js
- Modify: styles.css
- Modify: test/ui.test.js
- Modify: test/controller.test.js

- [ ] **Step 1: Skriv failing edge-state-tester**

Testa:

- profil utan vistelser visar tomläge och add-stay-action,
- delvis exkluderad vistelse visar antal och datumintervall som inte räknats,
- passerad planerad vistelse frågar om utfallet men ändras inte automatiskt,
- edit-profile återanvänder profilformuläret utan att förlora vistelser,
- clear confirmation beskriver profil och alla vistelser som tas bort,
- clear cancel lämnar state orört,
- unsupported storage-version blockerar save tills explicit clear,
- session och memory visar "Data kan försvinna när sidan stängs".

- [ ] **Step 2: Kör testet och verifiera rött**

Run: npm test -- test/ui.test.js test/controller.test.js

Expected: FAIL på nya edge-state-assertions.

- [ ] **Step 3: Implementera minsta edge-state-UI**

Återanvänd renderOnboarding som profilinställningsform. Lägg två inline-confirmation-komponenter i cockpit: en för rensning och en för borttagning av vistelse. Blockerande fel har role alert; fältnära fel använder aria-invalid och aria-describedby. Budget över gränsen använder copy "Planen ligger N dagar över din personliga budget".

- [ ] **Step 4: Verifiera och commit**

Run: npm test -- test/ui.test.js test/controller.test.js

Expected: alla edge-state-tester passar.

~~~bash
git add src/ui/onboarding.js src/ui/cockpit.js src/controller.js src/main.js styles.css test/ui.test.js test/controller.test.js
git commit -m "feat: complete planner empty and error states"
~~~

### Task 12: README, QA-script och full verifiering

**Files:**

- Create: README.md
- Create: docs/qa/localhost.md
- Modify: test/tooling.test.js
- Modify: scripts/lint.mjs

- [ ] **Step 1: Dokumentera lokala kommandon och produktgräns**

README.md ska innehålla:

- Node 20+ som enda förutsättning,
- npm run dev och URL från serveroutput,
- npm run check,
- att data sparas i aktuell webbläsare,
- att verktyget inte fastslår skattehemvist eller juridisk säkerhet,
- hur all lokal data rensas via UI,
- att konto och molnsynk inte ingår i MVP:n.

- [ ] **Step 2: Lägg ett 6-stegs manuellt QA-script**

docs/qa/localhost.md ska innehålla exakt:

1. Starta med tom lagring. Verifiera disclaimer, demo och att omvänd period eller budget 0 blockeras med fältnära fel.
2. Spara period 2026-08-01 till 2026-08-31 och budget 5. Verifiera nollvärden och "Inga Sverigedagar registrerade".
3. Lägg faktisk 2026-08-01 till 2026-08-02 och planerad 2026-08-02 till 2026-08-06. Verifiera 2 faktiska, 5 planerade, 6 unika, 1 över budget, faktisk status 2 augusti och senaste inom budget 5 augusti.
4. Redigera den planerade vistelsen, bekräfta en passerad plan och radera en vistelse. Verifiera omräkning, bekräftelser och fokusretur.
5. Sätt svenskt medborgarskap till ja och ett anknytningssvar till ja. Verifiera konkret underlag, neutral copy, officiell länk och "senast granskad 2026-08-16".
6. Testa 375 px, 200 procent zoom och endast tangentbord. Verifiera roving focus, dialogfokus, status utan färg och "Rensa all data" tillbaka till onboarding.

- [ ] **Step 3: Skärp lint- och tooling-tester**

Lägg assertions för att:

- alla src-filer klarar node --check,
- inga console-anrop finns under src,
- build-output saknar docs, test, .git och lagrade mockups,
- servern returnerar 404 för path traversal och okända filer,
- alla externa länkar har rel="noreferrer",
- index.html har lang sv, viewport, main, live-region, dialog och noscript.

- [ ] **Step 4: Kör full automatisk verifiering**

Run: npm run check

Expected: lint exit 0, samtliga node:test-tester passar och dist byggs utan fel.

- [ ] **Step 5: Kör UI-QA på localhost**

Run: npm run dev

Expected: serveroutput med prefix [sverigevistelseplanerare serve] och en localhost-URL.

Följ samtliga sex steg i docs/qa/localhost.md. Dokumentera endast avvikelser; om en avvikelse hittas, skriv först ett reproducerande test och gör minsta fix innan hela npm run check och QA-scriptet körs om.

- [ ] **Step 6: Kontrollera scope och Git-diff**

Run: git status --short

Expected: endast planerade MVP-filer är ändrade.

Run: git diff --check

Expected: ingen output och exit 0.

Run: git diff --stat

Expected: endast filerna i denna plans filkarta.

- [ ] **Step 7: Final commit**

~~~bash
git add README.md docs/qa/localhost.md package.json index.html styles.css src scripts test
git commit -m "docs: add localhost QA and MVP usage"
~~~

## Spec-täckning

| Designspec | Implementeras och verifieras i |
|---|---|
| Mål, målgrupp och MVP-gräns | planens scope, Task 8–12 |
| Produktprinciper och separat juridisk panel | Task 6 och Task 9 |
| Onboarding och kalendercockpit | Task 8 och Task 9 |
| Skapa, redigera, bekräfta och radera vistelse | Task 3, Task 10 och Task 11 |
| Versionsmärkt AppState utan härledda värden | Task 3 och Task 7 |
| UTC-baserad inklusiv dagräkning | Task 2 och Task 4 |
| Budget, periodklippning och gränsdatum | Task 4 |
| Femårsdag, sex månader, avbrott och rullande fönster | Task 5 och Task 6 |
| Väsentlig anknytning och officiella källor | Task 6 |
| localStorage, sessionsfallback, minnesfallback och rensning | Task 7, Task 10 och Task 11 |
| Tomlägen, fel, passerad plan och exkluderade datum | Task 8, Task 9 och Task 11 |
| Beroendefri arkitektur, lint, build och test | Task 1–12 |
| Localhost, responsivitet, tangentbord och QA | Task 9–12 |

## Slutlig acceptans

Innan implementationen kallas klar måste följande vara sant:

- npm run check är grön från ren checkout,
- QA-scriptets sex steg fungerar i Chrome på localhost,
- faktiska, planerade och unika dagar följer de låsta algoritmbesluten,
- juridiska kort visar fakta, scenarioetikett, officiell källa och reviewedAt,
- localStorage-, sessionStorage- och memory-lägen är testade,
- inga resedatum eller profilvärden loggas,
- ingen ny dependency, backend eller databas har lagts till,
- Git-diffen innehåller bara MVP-filerna.
