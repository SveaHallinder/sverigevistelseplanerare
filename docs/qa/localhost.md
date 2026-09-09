# QA på localhost

Kör `npm run dev` och öppna URL:en som servern skriver ut.

## Snabb QA för lokal beta

Använd en separat webbläsarprofil med syntetiska testdata. `localhost` och `127.0.0.1` har separata lagringsutrymmen; behåll samma URL under testet.

1. Prova demo: en månad med exempelvistelser visas, utan redigerings- eller exportmöjlighet. Återgå och kontrollera att tom dagbudget ger fältnära fel. Skapa en plan med utflyttning 2025-01-01, period 2026-08-01–2026-08-31 och budget 5; verifiera tomläge och augustikalender.
2. Klicka 1 augusti och registrera faktisk vistelse 1–2 augusti. Lägg planerad vistelse 2–6 augusti. Förhandsvisningen ska direkt visa 1 dag över budget; öppna ”Visa beräkning” för 5 vistelsedagar, 4 nya unika dagar och 1 överlappande dag. Översikten ska visa 2 faktiska, 5 planerade, 6 unika och 1 över budget. Gränsdatumen finns under ”Så räknas planen”.
3. Öppna 1 augusti för direkt redigering. Öppna 2 augusti med Enter: väljaren visar båda vistelserna. Välj den planerade och ändra avresa till 5 augusti; kontrollera 5 unika och 0 kvar. Ändra månadsdelen med uppåtpilen två gånger: månaden ska ändras båda gångerna, utan att fokus hoppar till året. Öppen beräkning ska förbli öppen vid ändring. Ange avresa före ankomst och spara: avresan ska få fokus. Rätta datumet och spara med ett klick. Escape ska återföra fokus. "Nej, blev inte av" ska öppna borttagningsbekräftelse med Avbryt i fokus; avbryt utan dataändring.
4. Bläddra över december/januari och växla månad/år. Budgetperioden ska vara oförändrad. Kontrollera 320, 375, 640, 768, 1280 och 1600 px, 200 procent zoom och piltangenter över månadsskifte. Vistelser ska ligga före kalendern på mobil och kalenderdagar ska inte klippas. Öppna dialogen vid 375×667 och 667×375: sparraden ska vara synlig även med utfälld beräkning, och Tab/piltangenter ska behålla fokus på vald status.
5. Ladda ner JSON och CSV. Välj backupen, kontrollera förhandsgranskning och att kalenderredigering, avbokning och Inställningar blockeras innan bekräfta/avbryt. Avbryt, välj samma fil igen och bekräfta återställningen. Ladda om och kontrollera data. Ogiltig JSON ska lämna planen oförändrad.
6. Kör `npm run check`. Upprepa huvudflödet i Safari och Firefox och mot `npm run preview` efter att dev-servern stoppats. Kryssa bara av faktiskt utförda kontroller i matrisen nedan.

## Verifierat 2026-09-07

- Lint, 358 automatiska tester och build passerar. Beräkning, backup/restore och lagringskonflikter täcks fortsatt av tester; nya fall täcker kalenderredigering, överlappsväljare, avbokningsfokus, månadsväxling utan persistens, sparrad utanför formulärets scrollyta, bevarade datum- och statuskontroller samt fokus vid formulärfel.
- Sista UX-passet: ett native datumfel reproducerades i Chrome. Två uppåtpilar i månadsdelen gav först september 2026, sedan september 2027 eftersom dialogen ritades om. Efter rättning ger samma handling september och oktober 2026. Endast förhandsvisningen uppdateras; utfälld beräkning bevaras. Ogiltig avresa fokuseras direkt och gamla fel tas bort vid ändring. Ogiltig dagbudget fokuseras på både inställningsvyn och första onboarding. Lokal lagring är synlig i mobilvyn och tillgänglighetsträdet. Feltextens kontrast har ökats.
- Byggd version på `http://127.0.0.1:4174/`: första onboarding med tom budget, felfokus, skapad plan, tomläge, faktisk vistelse 1–2 september och planerad 2–6 september verifierade. Förhandsvisningen visar 4 nya unika dagar, 1 överlapp och 1 över budget. Sparraden är synlig i 667×375 även med öppnad beräkning.
- UI-polish: tydlig kvar/över-siffra, tre kompakta dagmått och högre kontrast. Budgetens gränsdatum ligger under ”Så räknas planen”. Dialogen visar budgeteffekten direkt och beräkningsdetaljer vid behov; dagar utanför perioden förblir synliga. Chrome: översikt utan sidöverflow vid 320–1600 px; sparrad synlig med utfällda detaljer i 667×375; faktisk/planerad behåller rätt fokus; sparande och omladdning verifierade.
- Chrome: onboarding, demo, tomläge, överlapp 2/5/6, redigering till 2/4/5, Escape/fokusretur, avbruten borttagning och omladdning verifierade. Kalenderår ändras utan att budgetperioden ändras. Backup/CSV-knapparna når "Filen är klar".
- Mobil- och desktoplayout har granskats visuellt. Årskalendern är efter korrigering verifierad vid 375, 640, 768, 1280 och 1600 px utan sid- eller månadsöverflow. Vistelser ligger före kalendern på mobil. Riktig 200-procentszoom återstår att kontrollera manuellt.
- Byggd kopia från `dist/` har serverats separat på port 4174: onboarding och demo med aprilkalender och 19/8/27 dagar fungerar, utan observerade konsolfel.
- Chrome-loggen innehöll fel från ett installerat webbläsartillägg (`chrome-extension://…/content_script.js`), inga observerade appfel.
- Återställning via riktig filväljare kunde inte slutföras automatiskt: Chrome-tillägget saknar "Allow access to file URLs". Logiken och spärrarna passerar automatiska tester; steg 5 återstår som manuell fil-QA.
- Safari WebDriver startar, men avvisar testsessionen: `You must enable 'Allow remote automation' in the Developer section of Safari Settings`. Aktivera Safari → Inställningar → Utvecklare → Tillåt fjärrautomatisering för att fortsätta. Inställningen har inte ändrats automatiskt. Firefox och riktig iPhone/iOS har inte testats. Matrisen nedan är därför fortsatt öppen.
- Tre av fem officiella juridiska källor kunde läsas utan upptäckt motsägelse. Båda `www4.skatteverket.se/rattsligvagledning/…`-länkarna svarade "Request Rejected". `reviewedAt` är oförändrat; full källverifiering och extern juridisk granskning återstår.
- En avgränsad Node-mätning, utan DOM/layout: 200 sjudagarsvistelser över tio år tog cirka 364 ms för modell + HTML. En tjugoårig vistelse tog cirka 1,15 s. Mycket långa intervall kan därför ge märkbar synkron väntan; detta är inte en webbläsarbenchmark.

## Kort användartest, ännu inte utfört

Låt en person som inte har sett appen göra uppgifterna nedan med syntetiska data i en separat webbläsarprofil. Be personen tänka högt, men förklara inte var knapparna finns. Anteckna tid, tvekan, fel och om hjälp behövdes. Det här är ett förberett testmanus; ingen verklig testperson har deltagit i denna session.

1. Skapa en plan för augusti 2026 med egen budget på 5 dagar. Be personen förklara vad budgeten betyder och var uppgifterna sparas.
2. Registrera en faktisk vistelse 1–2 augusti och en planerad 2–6 augusti. Be personen säga hur många dagar som räknas och om planen ryms inom den egna budgeten.
3. Ändra den planerade vistelsen så att den slutar 5 augusti. Personen ska hitta rätt vistelse och spara utan hjälp.
4. Försök ange avresa före ankomst. Personen ska förstå felet, rätta det och fortsätta utan att börja om.
5. Be personen hitta hur en backup sparas, ladda om sidan och kontrollera att planen finns kvar.

Målet är att alla fem uppgifter klaras utan vägledning och att personen inte tolkar dagbudgeten som ett juridiskt besked. Dokumentera faktiska resultat innan UX-betyget höjs på grund av användartester.

## Fördjupad regression

1. Starta med tom lagring. Verifiera disclaimer, demo och att omvänd period eller budget 0 blockeras med fältnära fel.
2. Spara period 2026-08-01 till 2026-08-31 och budget 5. Verifiera nollvärden och "Inga Sverigedagar registrerade".
3. Lägg faktisk 2026-08-01 till 2026-08-02 och planerad 2026-08-02 till 2026-08-06. Verifiera 2 faktiska, 5 planerade, 6 unika, 1 över budget, faktisk status 2 augusti och senaste inom budget 5 augusti. Öppna "Så räknas planen". Verifiera inkluderande ankomst/avresa, en överlappande dag, inkluderade/exkluderade intervall, faktisk/scenario-mönsterfakta, "Senaste registrerade dag inom budget: 5 augusti 2026" och "Första registrerade dag över budget: 6 augusti 2026". Ingen text får kalla datumen juridiskt säkra eller säga att användaren måste lämna Sverige.
4. Redigera den planerade vistelsen, bekräfta en passerad plan och radera en vistelse. Verifiera omräkning, bekräftelser och fokusretur.
5. Sätt svenskt medborgarskap till ja och ett anknytningssvar till ja. Verifiera konkret underlag, neutral copy, officiell länk och "senast granskad 2026-08-16".
6. Testa 375 px, 200 procent zoom och endast tangentbord. Verifiera roving focus, dialogfokus, status utan färg och "Rensa all data" tillbaka till onboarding.
7. Öppna "Din data". Verifiera att JSON-nedladdningen bara innehåller AppState v1 och att en giltig backup visar förhandsgranskning men skriver först efter bekräftelse. Verifiera att avbrytning, ogiltig JSON, version 2, fil över 1 MiB och en redan blockerande lagring stoppar före persistens och behåller aktuell data. Verifiera exakt CSV-header, sortering, `faktisk`/`planerad` och inkluderande kalenderdagar utan profilsvar, id eller tidsstämplar. Verifiera att en tom vistelselista inte laddar ner någon CSV, att samma backupfil kan väljas två gånger, att tangentbordsfokus och uppläsningar fungerar och att demoläget saknar datakontroller. Verifiera att medan en förhandsgranskning väntar går varken vistelsedialogen eller Inställningar att öppna via klick eller Enter, utan att samma orsak läses upp, och att båda fungerar igen efter avbryt eller bekräftelse. Framtvinga en lagringskonflikt efter skrivning och verifiera att controllerns data och förhandsgranskningen behålls, att varningen säger att backupen kan ha skrivits delvis och att återhämtningsflödet med avbryt, omladdning och rensning visas.

## Webbläsarmatris

Stegen ovan är verifierade i Chromium. Kör om dem i Safari och Firefox innan appen publiceras och kryssa av de fyra riskpunkterna nedan, som är de enda ställen där webbläsarna skiljer sig i praktiken.

- [ ] **Safari** — vistelsedialogen: öppnas modalt, stängs med Escape, fokus återgår till knappen som öppnade den.
- [ ] **Safari privat läge** — kontrollera faktisk lagringsförmåga. Om lagring nekas ska appen starta med en korrekt varning och fortsätta fungera med tillgänglig reservlagring.
- [ ] **Safari, inklusive iOS** — nedladdning av backup och CSV. `<a download>` med blob-URL är historiskt opålitligt på iOS och kan öppna filen i stället för att spara den. Notera vad som faktiskt händer; det är en känd begränsning, inte en regression.
- [ ] **Firefox** — filväljaren: välj samma backupfil två gånger i rad och verifiera att förhandsgranskningen visas båda gångerna.

Verifiera samtidigt i båda webbläsarna att `type="date"`-fälten går att fylla i, att inga konsolfel uppstår och att kalendern inte får horisontell scroll vid 375 px.

## Publicerad kopia

Kör `npm run build` följt av `npm run preview` och gör om steg 1, 3 och 7 mot den byggda kopian. Verifiera att `styles.css` och `src/main.js` läses in utan 404 och att ingen `favicon.ico` begärs.
