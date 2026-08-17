# QA på localhost

Kör `npm run dev` och öppna URL:en som servern skriver ut.

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
- [ ] **Safari privat läge** — `localStorage` kastar där. Verifiera att appen startar, visar varningen om att data försvinner och fortsätter fungera i minnesläge.
- [ ] **Safari, inklusive iOS** — nedladdning av backup och CSV. `<a download>` med blob-URL är historiskt opålitligt på iOS och kan öppna filen i stället för att spara den. Notera vad som faktiskt händer; det är en känd begränsning, inte en regression.
- [ ] **Firefox** — filväljaren: välj samma backupfil två gånger i rad och verifiera att förhandsgranskningen visas båda gångerna.

Verifiera samtidigt i båda webbläsarna att `type="date"`-fälten går att fylla i, att inga konsolfel uppstår och att kalendern inte får horisontell scroll vid 375 px.

## Publicerad kopia

Kör `npm run build` följt av `npm run preview` och gör om steg 1, 3 och 7 mot den byggda kopian. Verifiera att `styles.css` och `src/main.js` läses in utan 404 och att ingen `favicon.ico` begärs.
