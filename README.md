# Sverigevistelseplaneraren

Ett lokalt verktyg för att dokumentera och planera registrerade Sverigedagar, med webbversion och nativeapp för iPhone/iPad.

## Förutsättning

Webbversionen kräver Node.js 20 eller senare för utveckling och tester. Inga tredjepartspaket behövs. Nativebygget kräver fullständigt Xcode.

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

Det aktuella webbflödet är testat i Chrome. Koden har fallback för bland annat `crypto.randomUUID` och `showModal`; en API-baslinje är inte samma sak som verifierat stöd på en viss enhet.

Se [localhost-QA](docs/qa/localhost.md) för verifierade resultat och kvarvarande kompatibilitetskontroller.

## Native app

~~~bash
node scripts/build-ios.mjs
~~~

Kommandot paketerar samma webbgränssnitt och beräkningar i `native/ios/Web/` och bygger ett osignerat Debug-bygge för iOS Simulator. Projektet har en delad Xcode-scheme för iPhone och iPad, deployment target iOS 16. Ingen simulatorruntime hämtas automatiskt.

Bygg den optimerade Release-konfigurationen för lokal simulator-QA:

~~~bash
node scripts/build-ios.mjs --stage-only
xcodebuild -project native/ios/Sverigevistelseplaneraren.xcodeproj \
  -scheme Sverigevistelseplaneraren -configuration Release \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath native/ios/build CODE_SIGNING_ALLOWED=NO build
~~~

Paketet finns i `native/ios/build/Build/Products/Release-iphonesimulator/Sverigevistelseplaneraren.app`. Körning kräver en installerad iOS-runtime; i Xcode 27 hanteras simulatorerna i [Device Hub](https://developer.apple.com/documentation/xcode/device-hub). Projektets Archive-action använder också Release. Det lokala kommandot ovan signerar ingen distribution.

För lokal körning på Mac via Mac Catalyst:

~~~bash
node scripts/build-ios.mjs --catalyst
~~~

Öppna `native/ios/build-catalyst/Build/Products/Debug-maccatalyst/Sverigevistelseplaneraren.app`. Nativeappen läser bundlade resurser, sparar lokalt och använder systemets filväljare för JSON-backup och CSV. Import valideras med samma regler som i webben och kräver separat bekräftelse. `--stage-only` uppdaterar enbart de bundlade webbfilerna.

Se [lanseringsunderlaget](docs/release/readiness.md) för signerad distribution, iPhone/iPad-QA och publiceringsuppgifter som återstår. Ett kompilerat testbygge är inte ett App Store-godkännande.

## Data och MVP-gräns

Data sparas lokalt i den aktuella webbläsaren eller nativeappen, med separata lagringsytor. Rensa all lokal appdata genom att klicka på **Rensa all data** i UI:t och bekräfta rensningen.

Cockpiten visar hur registrerade dagar, överlapp, exkluderade datum och personliga budgetgränser har räknats.

Översikten börjar med personlig budget och budgetperiod. Vistelser visas före kalendern på mobil. Kalendern börjar med en månad och kan växlas till hela året; kalendernavigering ändrar inte budgetperioden. Klicka en registrerad dag för att redigera, eller välj mellan vistelser när de överlappar.

Dagbudgeten väljs aktivt när en plan skapas. Vistelsedialogen visar hela vistelsens längd, nya unika dagar, överlapp och datum utanför budgetperioden innan du sparar.

Under "Din data" kan användaren ladda ner en lokal JSON-backup, återställa en validerad backup efter uttrycklig bekräftelse och exportera vistelser som CSV. Filerna skickas inte till en server.

Verktyget fastslår inte skattehemvist eller juridisk säkerhet och ersätter inte individuell juridisk rådgivning. Konto och molnsynk ingår inte i MVP:n.

Sverigedagar räknas på samma sätt oavsett svensk stad. Verktyget lagrar inga stadsuppgifter och använder ingen platsbehörighet. Datumräkningen använder UTC-kalenderdagar; dagens datum hämtas från enhetens lokala datum och uppdateras när appen åter blir aktiv. Utländska skatte- eller vistelseregler ingår inte.

## Fortsatt utveckling med Claude

Claude Code läser [CLAUDE.md](CLAUDE.md) automatiskt. Aktuellt nuläge, läsordning och nästa arbete finns i [docs/handoff/CURRENT.md](docs/handoff/CURRENT.md).

Båda tidigare sprintplanerna är genomförda:

1. [Funktionell och juridisk hårdsäkring](docs/superpowers/plans/2026-08-16-functional-hardening.md)
2. [Lokal backup, återställning och CSV-export](docs/superpowers/plans/2026-08-16-local-data-portability.md)

Referenser:

- [Pågående kommersiell hårdsäkring och nativepaket](docs/superpowers/plans/2026-10-05-commercial-readiness.md)
- [Produktstatus och lanseringsunderlag](docs/release/readiness.md)
- [Aktuellt localhost-QA](docs/qa/localhost.md)
- [Implementerad MVP-design](docs/superpowers/specs/2026-08-16-sverigevistelseplanerare-design.md)
- [Historisk MVP-plan](docs/superpowers/plans/2026-08-16-sverigevistelseplanerare-mvp.md)

Starta `claude` i repots rot och skriv:

~~~text
Läs CLAUDE.md och docs/handoff/CURRENT.md. Den lokala användarupplevelsen är uppdaterad. Kör npm run check och följ kvarvarande QA; bygg inte om redan färdiga sprintar.
~~~

Lokal QA och kvarvarande begränsningar finns i `docs/qa/localhost.md`. App Store-publicering kräver bland annat verifiering på iPhone/iPad, utgivarens signering, support och publicerad integritetspolicy. Full juridisk källverifiering och extern granskning återstår. Konto och molnsynk ligger efter den lokala betan.
