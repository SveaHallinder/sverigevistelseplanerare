# Sverigevistelseplaneraren

En lokal MVP för att dokumentera och planera registrerade Sverigedagar.

## Förutsättning

Node.js 20 eller senare är den enda förutsättningen.

## Starta lokalt

~~~bash
npm run dev
~~~

Öppna localhost-URL:en som servern skriver ut.

## Kontrollera projektet

~~~bash
npm run check
~~~

Kommandot kör lint, automatiska tester och build.

## Publicera

`npm run build` skriver en statisk kopia till `dist/` (endast `index.html`, `styles.css` och `src/`). Inga byggsteg transformerar koden, så `dist/` kan läggas på valfri statisk webbserver.

`index.html` refererar sina resurser relativt, så appen fungerar både på en domänrot och i en underkatalog, till exempel ett projekt-URL på GitHub Pages. Verifierat genom att servera `dist/` som `/min-app/` på en vanlig statisk server.

Förhandsgranska den byggda kopian med `npm run preview`. Observera att `scripts/serve.mjs` är ett medvetet låst utvecklingsverktyg: det servar bara `index.html`, `styles.css` och `src/` från roten och gör ingen katalogindex-uppslagning, så det kan inte användas för att testa underkatalogsscenariot.

## Webbläsarstöd

Testad i Chromium. Koden använder `dialog.showModal()`, `Array.prototype.at`, `String.prototype.replaceAll`, `File.text()` och `Intl.DateTimeFormat` med `timeZone`, vilket ger baslinjen **Safari 15.4+, Firefox 98+ och Chrome 92+**. `crypto.randomUUID` och `showModal` anropas bakom funktionskontroller och har fallback.

Se `docs/qa/localhost.md` för den manuella webbläsarmatrisen som återstår.

## Data och MVP-gräns

Data sparas lokalt i den aktuella webbläsaren. Rensa all lokal appdata genom att klicka på **Rensa all data** i UI:t och bekräfta rensningen.

Cockpiten visar hur registrerade dagar, överlapp, exkluderade datum och personliga budgetgränser har räknats.

Översikten börjar med personlig budget och budgetperiod. Vistelser visas före kalendern på mobil. Kalendern börjar med en månad och kan växlas till hela året; kalendernavigering ändrar inte budgetperioden. Klicka en registrerad dag för att redigera, eller välj mellan vistelser när de överlappar.

Dagbudgeten väljs aktivt när en plan skapas. Vistelsedialogen visar hela vistelsens längd, nya unika dagar, överlapp och datum utanför budgetperioden innan du sparar.

Under "Din data" kan användaren ladda ner en lokal JSON-backup, återställa en validerad backup efter uttrycklig bekräftelse och exportera vistelser som CSV. Filerna skickas inte till en server.

Verktyget fastslår inte skattehemvist eller juridisk säkerhet och ersätter inte individuell juridisk rådgivning. Konto och molnsynk ingår inte i MVP:n.

## Fortsatt utveckling med Claude

Claude Code läser [CLAUDE.md](CLAUDE.md) automatiskt. Aktuellt nuläge, läsordning och nästa arbete finns i [docs/handoff/CURRENT.md](docs/handoff/CURRENT.md).

Båda tidigare sprintplanerna är genomförda:

1. [Funktionell och juridisk hårdsäkring](docs/superpowers/plans/2026-08-16-functional-hardening.md)
2. [Lokal backup, återställning och CSV-export](docs/superpowers/plans/2026-08-16-local-data-portability.md)

Referenser:

- [Aktuellt localhost-QA](docs/qa/localhost.md)
- [Implementerad MVP-design](docs/superpowers/specs/2026-08-16-sverigevistelseplanerare-design.md)
- [Historisk MVP-plan](docs/superpowers/plans/2026-08-16-sverigevistelseplanerare-mvp.md)

Starta `claude` i repots rot och skriv:

~~~text
Läs CLAUDE.md och docs/handoff/CURRENT.md. Den lokala användarupplevelsen är uppdaterad. Kör npm run check och följ kvarvarande QA; bygg inte om redan färdiga sprintar.
~~~

Lokal QA och kvarvarande begränsningar finns i `docs/qa/localhost.md`. Safari, Firefox och full juridisk källverifiering återstår före extern lansering. Konto och molnsynk ligger efter den lokala betan.
