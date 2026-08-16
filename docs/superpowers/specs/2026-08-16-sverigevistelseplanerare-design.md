# Sverigevistelseplanerare — MVP-design

Datum: 2026-08-16

Status: Implementerad MVP, automatiskt verifierad och manuellt QA-testad 2026-08-16

## 1. Mål

Bygg en snabb, demo-redo och local-first webbapp för personer som redan har flyttat från Sverige. Appen ska hjälpa användaren att dokumentera faktiska Sverigebesök, planera framtida besök och hålla en personlig dagbudget.

Appen är ett beslutsstöd. Den får aldrig fastslå skatteresidens, skattskyldighet eller att en plan är juridiskt säker.

## 2. Primär användare

Första versionen riktar sig till en person som:

- redan har flyttat från Sverige,
- vill logga historiska Sverigebesök,
- vill planera kommande Sverigebesök,
- har valt en egen dagbudget, typiskt efter rådgivning,
- accepterar att data endast sparas i den aktuella webbläsaren under MVP:n.

## 3. MVP-avgränsning

### Ingår

- en profil per webbläsare,
- utflyttningsdatum,
- personlig dagbudget och vald budgetperiod,
- faktiska och planerade vistelseintervall i Sverige,
- årskalender med tydlig skillnad mellan faktisk och planerad vistelse,
- exakt dagräkning och återstående budget,
- beräkning av första budgetöverskridande datum och senaste dag inom budget,
- transparenta juridiska observationer och källänkar,
- frivillig checklista för väsentlig anknytning,
- lokal lagring, sessionsfallback och möjlighet att rensa all data,
- responsiv UI som kan testas på localhost.

### Ingår inte

- bedömning av skattehemvist i Sverige eller annat land,
- destinationsländers regler,
- konto, backend, databas eller molnsynk,
- kalenderimport, positionsdata eller automatisk resehämtning,
- AI-rådgivning eller juridisk riskpoäng,
- dokumentuppladdning, rådgivardelning eller export,
- automatisk uppdatering av rättskällor,
- kapitalbeskattningsmotor, tioårsregelberäkning eller deklarationsstöd,
- betalning eller premiumfunktioner.

Konton och molnsynk är en möjlig senare fas. MVP:n ska inte bygga den infrastrukturen.

## 4. Produktprinciper

1. Matematiska resultat och juridiska observationer visas separat.
2. Ett grönt budgetläge betyder endast att användarens egen budget hålls.
3. Omarkerade dagar betyder "inte registrerade", aldrig bevisad utlandsvistelse.
4. Alla observationer visar vilka datum eller svar de bygger på.
5. Juridisk copy använder "kräver individuell bedömning", inte "lagligt", "olagligt" eller "säker".
6. Ingen dold premiumspärr förekommer.

## 5. Kärnflöde

### 5.1 Onboarding

Användaren möts av en kort förklaring: appen räknar registrerade kalenderdagar och är inte juridisk rådgivning. Därefter anges:

- utflyttningsdatum,
- personlig dagbudget,
- budgetperiodens start- och slutdatum, med innevarande kalenderår som standard,
- frivilliga svar om svenskt medborgarskap eller minst tio års tidigare bosättning/vistelse,
- frivillig juridisk checklista.

Användaren ska aktivt spara profilen innan dashboarden visar personliga resultat.

### 5.2 Kalendercockpit

Den valda huvudvyn är en årskalender. Överst visas:

- faktiska dagar,
- planerade dagar,
- unika registrerade dagar totalt,
- återstående eller överskriden personlig budget,
- senaste dag inom budget för den aktuella planen.

Faktiska och planerade datum skiljs med både färg och text/legend, så informationen inte är beroende av färgseende. Kalendern kompletteras av en kompakt lista över vistelser.

### 5.3 Lägg till eller redigera vistelse

Klick på ett datum eller knappen "Lägg till vistelse" öppnar samma formulär:

- ankomstdatum,
- avresedatum,
- status: faktisk eller planerad.

Ankomst- och avresedag räknas inkluderande. En resa kan redigeras eller tas bort. Passerade planerade resor ändras aldrig automatiskt till faktiska; UI:t frågar om resan genomfördes.

### 5.4 Juridiska observationer

En separat panel visar endast relevanta observationer. Varje kort innehåller:

- rubrik och neutral allvarlighetsnivå,
- exakt underlag från datum eller användarsvar,
- förklaring av varför frågan kan spela roll,
- uppmaning att ta individuell rådgivning där bedömning krävs,
- länk till officiell källa och datum då källan senast granskades.

## 6. Datamodell

MVP:n lagrar ett versionsmärkt dokument med denna logiska struktur:

```text
AppState
  version: 1
  profile
    departureDate: YYYY-MM-DD
    budgetDays: positive integer
    periodStart: YYYY-MM-DD
    periodEnd: YYYY-MM-DD
    swedishCitizen: yes | no | unanswered
    livedInSwedenTenYears: yes | no | unanswered
    connectionChecklist: map of yes | no | unanswered
  stays[]
    id: locally generated stable identifier
    arrivalDate: YYYY-MM-DD
    departureDate: YYYY-MM-DD
    status: actual | planned
    createdAt: ISO timestamp
    updatedAt: ISO timestamp
```

Inga härledda summor sparas. Resultat räknas om från profil och vistelser. Inga destinationer, adresser, inkomster, passuppgifter eller fritextanteckningar lagras.

Datamodellen hålls serialiserbar och versionsmärkt för att en senare kontofas ska kunna migrera lokal data, men ingen synkkod byggs i MVP:n.

## 7. Beräkningsregler

### 7.1 Kalenderdatum

- Datum representeras som `YYYY-MM-DD` utan klockslag.
- Datumberäkning sker kalenderbaserat i UTC för att undvika fel vid sommartid och tidszonsbyte.
- Både ankomst- och avresedag ingår.
- Ett datum räknas högst en gång även om intervall överlappar.
- Om faktisk och planerad vistelse överlappar har faktisk status företräde i presentationen.

### 7.2 Budget

- Budgeten måste vara ett heltal mellan 1 och antalet kalenderdagar i vald period.
- Endast registrerade datum inom budgetperioden räknas mot budgeten.
- Vistelser utanför perioden sparas, men UI:t visar vilka datum som exkluderats.
- `remaining = budgetDays - uniqueRegisteredDaysInPeriod`.
- Ett negativt värde visas som antal dagar över budget, inte som ett juridiskt övertramp.
- För en planerad vistelse beräknas det första datum då unionen av registrerade datum överstiger budgeten. Föregående kalenderdatum i vistelsen är den senaste dagen inom användarens budget.
- Om budgeten redan är förbrukad före en ny planerad vistelse visas att ingen ytterligare registrerad dag ryms.

### 7.3 Faktisk och planerad vistelse

- Faktiska och planerade dagar visas separat.
- Totalen är unionen av båda mängderna, inte summan av två potentiellt överlappande tal.
- Passerade planerade intervall ligger kvar som planerade tills användaren bekräftar, ändrar eller tar bort dem.

## 8. Juridisk varningsmotor

Motorn producerar observationer, inte slutsatser.

### 8.1 Femårsperioden

Om användaren uppger svenskt medborgarskap eller minst tio års tidigare bosättning/stadigvarande vistelse visar appen femårsdagen räknad från avresedagen som information om bevisbörda. Appen visar jubileumsdatumet och undviker att själv formulera ett juridiskt sista giltighetsdygn. Copy ska uttryckligen säga att fem år inte innebär automatisk skattskyldighet och att anknytning kan vara relevant även senare.

### 8.2 Stadigvarande vistelse och återkommande mönster

Appen visar längsta registrerade vistelse, antal besök, vistelsedagar och mellanliggande oregistrerade dagar. Följande reproducerbara observationer ingår:

- ett sammanhängande registrerat intervall som når sin sexmånadersdag flaggas för granskning,
- för två registrerade intervall jämförs det oregistrerade mellanrummet med intervallet före och efter,
- om mellanrummet inte når sexmånadersgränsen och är högst lika långt som åtminstone det föregående eller efterföljande intervallet visas "möjligt tillfälligt avbrott — kräver individuell bedömning",
- antal och periodicitet redovisas som fakta, men någon separat godtycklig gräns för "regelbundet" införs inte.

Överlappande eller direkt angränsande intervall slås ihop innan observationerna räknas. Appen får inte avgöra om ett avbrott faktiskt är tillfälligt eller om vistelsen juridiskt är stadigvarande.

Eftersom omarkerade datum inte bevisar utlandsvistelse ska de beskrivas som oregistrerade dagar.

### 8.3 Väsentlig anknytning

Den frivilliga checklistan omfattar översiktligt:

- åretruntbostad i Sverige,
- make, maka eller minderåriga barn i Sverige,
- näringsverksamhet i Sverige,
- tillgångar som kan ge väsentligt inflytande i svensk näringsverksamhet,
- fastighet i Sverige,
- andra starka personliga eller ekonomiska band.

Ett ja-svar skapar en persistent observationsrad och länkar till Skatteverkets vägledning. Ingen poäng eller automatisk helhetsbedömning görs.

### 8.4 Arbete och 183 dagar

MVP:n visar en informationsrad om att 183 dagar inte är en generell safe harbour. En full SINK-bedömning ingår inte. Om arbete under Sverigebesök tas upp i checklistan visar appen endast det högsta antalet registrerade dagar i något rullande tolvmånadersfönster och de ytterligare villkor som måste bedömas; den avgör inte om SINK eller undantaget är tillämpligt. Ett fönster löper från ett kalenderdatum till dagen före samma kalenderdatum ett år senare och utvärderas vid varje registrerat datum.

## 9. Officiella källor

Källorna visas i appen med `senast granskad 2026-08-16`:

- Inkomstskattelagen, särskilt 3 kap. 3 och 7 §§: <https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/inkomstskattelag-19991229_sfs-1999-1229/>
- Skatteverket, Har du flyttat från Sverige?: <https://www.skatteverket.se/privat/internationellt/bosattutomlands/harduflyttatfransverige.4.7459477810df5bccdd4800030036.html>
- Skatteverket, Stadigvarande vistelse i Sverige: <https://www4.skatteverket.se/rattsligvagledning/edition/2026.7/2637.html>
- Skatteverket, artikel 4 och skatteavtalshemvist: <https://www4.skatteverket.se/rattsligvagledning/edition/2026.5/2970.html>
- Skatteverket, 183-dagarsregeln i SINK: <https://www.skatteverket.se/privat/etjansterochblanketter/svarpavanligafragor/sink/sink/vadar183dagarsregelnisinkochvadinnebarden.5.5b35a6251761e6914206793.html>

## 10. Lokal lagring och integritet

- Primär lagring är `localStorage` under en namespacad v1-nyckel.
- Om lagring är blockerad fortsätter appen i sessionsläge och visar en beständig varning.
- Ett trasigt dokument ignoreras säkert; användaren får ett tydligt fel och kan börja om utan att sidan kraschar.
- "Rensa all data" kräver bekräftelse och beskriver exakt vad som tas bort.
- Ingen analys, telemetri eller loggning får innehålla profildata eller resedatum.
- UI:t säger "Sparas i den här webbläsaren" och påstår inte att webbläsarlagring är krypterad.

## 11. Tomlägen och fel

- Ingen profil: onboarding med primär handling och möjlighet att öppna ett tydligt syntetiskt demoexempel.
- Profil utan vistelser: "Inga Sverigedagar registrerade" och knapp för första vistelsen.
- Slutdatum före startdatum: sparning blockeras med fältnära fel.
- Ogiltig budget eller budgetperiod: sparning blockeras med exakt orsak.
- Överlapp: tillåts men förklaras; varje datum räknas en gång.
- Delvis utanför budgetperioden: vistelsen sparas och exkluderade datum redovisas.
- Passerad planerad vistelse: diskret uppmaning att bekräfta utfallet.
- Budget överskriden: neutral copy, exempelvis "Planen ligger 4 dagar över din personliga budget".

## 12. Teknisk arkitektur

MVP:n är en beroendefri statisk webbapp med små ES-moduler:

- appskal och semantisk HTML,
- responsiv CSS,
- datumverktyg,
- rena budget- och intervallberäkningar,
- ren observationsmotor utan DOM- eller lagringsberoende,
- versionsmärkt lagringsadapter,
- UI-rendering och formulärhändelser,
- juridisk copy och källmetadata i separat konfiguration.

Appen använder ingen backend, databas eller tredjepartsdependency. Ett minimalt lokalt Node-skript kan servera appen och ett separat skript kan skapa en statisk `dist`-mapp utan externa paket.

## 13. Teststrategi

Automatiska tester ska minst täcka:

- inkluderande ankomst- och avresedag,
- endagsvistelse,
- överlappande intervall och faktisk statusprioritet,
- budgetperiodens gränser,
- årsskifte, skottår och sommartidsdatum,
- faktiska kontra planerade dagar,
- första budgetöverskridande datum,
- redan förbrukad budget,
- rullande tolvmånadersfönster,
- femårsdatum,
- giltig, saknad, äldre och trasig lokal lagring.

Verifieringskommandon ska finnas för lint, build och test utan externa beroenden.

## 14. Definition of done

MVP:n är klar när:

1. användaren kan starta appen på localhost,
2. onboarding kan sparas lokalt,
3. faktiska och planerade vistelser kan skapas, redigeras och tas bort via UI,
4. kalender, budget och senaste dag uppdateras korrekt,
5. juridiska observationer är transparenta och källhänvisade,
6. tomlägen, fel och sessionsfallback är synliga och begripliga,
7. lint, build och automatiska tester går igenom,
8. ett manuellt QA-script med 3–7 steg har körts,
9. de exakta ändrade filerna kan visas i Git-diffen.
