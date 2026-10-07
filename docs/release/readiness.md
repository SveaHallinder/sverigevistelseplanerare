# Produktstatus och lanseringsunderlag

Uppdaterat 2026-10-07 med Release-kontroller, källuppdatering och installerad simulatorruntime. Målet är en produktionsapp lokalt. Publiceringsunderlaget från 2026-10-05 är oförändrat. Detta är ett granskningsbart lokalt produktpaket, inte ett besked om juridisk korrekthet eller godkänd distribution. Användaren hanterar App Store-publiceringen; utgivaruppgifter och signering är separata från den lokala appens arbete.

Senaste acceptanspasset utgår från `ef7dff4` utan ny produktkod. Färsk lint, 421/421 tester och webbbuild passerar. Nytt osignerat iPhone-enhetsbygge i Release passerar med 23 publika filer byteidentiska med källan. Aktuell Mac Catalyst Release verifierar hela datumfelet, avbrott, kall processstart och årsväxling med sparad plan bevarad. Senaste Release-installation över QA-iPad bevarar budget 5, oktoberperiod och 2/5/6; installerad exekverbar och webbfiler matchar simulatorpaketet. iPhone visar nu hela datumfelet vid maximal landskapstext och VoiceOver kan fokusera det visuellt. iPad vid maximal landskapstext verifierar nåbara formuläråtgärder, datumavvisning och avgränsad årsöversikt med sju veckokolumner och 2026 → 2027 → 2026. Extern UI-inmatning öppnade sedan ett iPad-datumutkast; det lämnades orört och ingen slutlig återställning eller planverifiering efter avbrottet hävdas.

Senaste produktändringen låter hela månadsnamnet få egen rad ovanför pilarna vid stor native-text. Tidigare pass verifierar maximal iPhone-kalender, överlappsval/avbrott, VoiceOver-fokusretur och oförändrad normal Chrome-layout. Full VoiceOver-uppläsning/ordning/aktivering, komplett stor-text-/formulär-/kalendermatris, iPads inställningsutkast genom avvisad import, fysisk/äldre OS och deltagartest återstår. Manuellt lyssningsresultat är efterfrågat och pending. Detta är inte 100 procent lokal produktionsacceptans. Se daterad evidens och femstegstestet i [localhost-QA](../qa/localhost.md).

## Vad produkten gör

Sverigevistelseplaneraren hjälper användaren att dokumentera faktiska och planerade vistelser i Sverige och jämföra registrerade kalenderdagar med en egen dagbudget. Ankomst- och avresedagar räknas inkluderande. Överlapp räknas en gång i totalen; faktiska och planerade dagar visas separat. Budgetperiod och kalendernavigation är separata.

Beräkningen beror inte på vilken svensk stad vistelsen gäller. Stadsnamn, GPS och platsbehörighet ingår inte. Andra länders skatteregler eller tillåtna vistelsetider har inte implementerats. Juridiska observationer beskriver underlag med officiella källor; de avgör inte skattehemvist, skattskyldighet eller ett tillåtet antal Sverigedagar.

Källornas relevanta avsnitt kontrollerades 2026-10-07. Vanlig Chrome-navigering öppnade båda sidorna i rättslig vägledning och deras senaste utgåva 2026.14; appens två äldre länkar och granskningsdatum uppdaterades i `1fd98a0`. Inga beräkningsregler ändrades. Protokoll och avgränsning finns i [localhost-QA](../qa/localhost.md); extern juridisk granskning har inte utförts.

Webbversionen fungerar på en statisk server. Nativepaketet använder samma JavaScript och validering, bundlade resurser och Apples SwiftUI, WebKit och filväljare. Inga tredjepartsberoenden, konton, betalningar eller dold premiumspärr har lagts till.

## Demo för en möjlig företagskund

Använd endast syntetiska uppgifter och en separat lagringsyta. En lokal demonstration kräver ingen extern dataöverföring.

1. Skapa en plan: utflyttning 2025-01-01, budget 5 och period 2026-10-01–2026-10-31. Visa tomläget och förklara den personliga budgeten.
2. Registrera faktisk vistelse 1–2 oktober och planerad vistelse 2–6 oktober. Visa 2 faktiska, 5 planerade, 6 unika och 1 över den egna budgeten; öppna beräkningsförklaringen.
3. Öppna 2 oktober, välj rätt vistelse och ändra planerad avresa till 5 oktober. Visa 5 unika och 0 kvar. Försök sedan ange avresa före ankomst och visa fältnära rättning.
4. Spara JSON och CSV. Visa att JSON innehåller profilen medan CSV bara innehåller vistelser. Välj en backup, avbryt och visa att planen inte ersattes; välj igen och bekräfta.
5. Stäng och öppna samma app/URL. Visa sparad plan, inställningar och hur data rensas efter bekräftelse. Beskriv ansvar för lokala backupfiler och juridisk bedömning.

Företagsleverans behöver ett faktiskt avtal om licens/överlåtelse, support, omfattning och ansvar. Pris, kunder, intäkter, juridiska garantier och äganderätt har inte antagits. Bekräfta rättigheterna till kod och tillgångar innan de licensieras eller säljs. Något företagsavtal har inte skickats eller accepterats.

## Lokal data och integritet

- Planen lagras i respektive webbläsares origin eller nativeappens lokala WebKit-lagring. Det finns ingen automatisk synk mellan webben, nativeappen eller olika enheter.
- JSON-backup innehåller profilsvar och vistelser i läsbar text. CSV innehåller vistelsedatum, status och inkluderande dagantal. Inga serveranrop skickar planen till en egen tjänst.
- Native import kräver ett aktivt filval och accepterar högst 1 MiB UTF-8. Filåtkomsten samordnas med systemet och JavaScript validerar innehållet före förhandsvisning och bekräftelse. En filprovider kan behöva hämta en fjärrfil innan läsning; gränsen är ingen garanti för nätverksmängden.
- Native export bekräftas först efter slutfört sparande via systemets filväljare. Användarens val av exempelvis iCloud Drive kan innebära lagring hos den tjänsten.
- Externa typsnitt har tagits bort. Att själv öppna en myndighetskälla använder internet och en vanlig webbläsare. Nativebryggan accepterar bara appens egen huvudframe och lokala origin.
- Rensning och avinstallation kan ta bort lokal data. Web Storage-fallback och konflikter visas i UI; skrivningar över två lagringslager är inte atomiska. Spara en backup innan byte av installation eller rensning.

En publicerad integritetspolicy behöver ange den verkliga utgivaren och kontaktvägen samt granska den slutliga signerade appen. Beskrivningen ovan är underlag, ingen påhittad policy-URL eller behandlingsansvarig.

## Verifiering och plattformsstatus

Det detaljerade protokollet finns i [localhost-QA](../qa/localhost.md). Kör alltid `npm run check` mot levererad commit.

| Yta | Verifierat | Kvar |
| --- | --- | --- |
| Webb i Chrome | Aktuell produktkälla: tomläge, kalenderns Tab/Enter, överlapp 2/5/6, datumfel/rättning/sparande/avbrott vid 375×812 och 812×375, budgetutkast genom avvisad import och riktig backupförhandsvisning/avbrott/bekräftelse/omladdning. Nya UI-exporter: JSON 844 byte och exakt CSV 114 byte. Tidigare daterad QA täcker ytterligare bredder och riktig 200 % zoom | Verkliga användartester och slutlig kompatibilitetsmatris; Chrome-resultatet verifierar inte native VoiceOver eller äldre iOS |
| Native Mac Catalyst | Aktuell Release körs: hela datumfelet, avbrott, kall processstart och årsväxling bevarar budget/period/2/5/6. Tidigare daterad Release-QA verifierar riktig JSON-import/bekräftelse och JSON/CSV-export med exakt filinnehåll; filflöden kördes inte om i senaste passet | Signerad sandbox/provider; tidigare vit fångst med okänd orsak enligt QA-protokollet |
| Native iPhone/iPad | Aktuella installerade Release-exekverbara/webbfiler matchar simulatorbygget. iPhone: hela felet vid maximal landskapstext, visuellt VoiceOver-fokus, tidigare maximal kalender och överlappsval/avbrott. iPad: plan efter uppdatering, maximal landskapsform/avvisning och avgränsad årsöversikt/årspilar. Tidigare daterad iPad-QA omfattar exakta JSON/CSV-filer och avvisad import | Full VoiceOver-uppläsning/ordning/aktivering, komplett stor-text-/formulär-/kalendermatris, iPads fulla maximala fel/rättning och inställningsutkast genom avvisad import, slutlig återställning efter extern UI-inmatning, fysisk/äldre OS |
| App Store | Xcode-projekt, delad scheme och appikon finns | Utgivare, signering, metadata, support/policy-URL, screenshots, avtal och Apple-granskning |

En grön testsvit eller ett osignerat bygge bevisar inte App Store-acceptans. Vid den tidigare inventeringen saknades giltiga distributionssigneringsidentiteter enligt `security find-identity -v -p codesigning`. Simulatorhämtningen godkändes 2026-10-06 och installation/signaturkontroll passerar 2026-10-07. Maclåset är löst och båda isolerade QA-simulatorerna har körts. Daterade resultat och kvarstående sexstegstest finns i [localhost-QA](../qa/localhost.md); målplattformarnas fullständiga sluttest är ännu inte klart.

Matematiska regressioner, fem tidszoner och oberoende referensfall är godkända enligt QA-protokollet. En absolut garanti om alla situationer eller juridisk korrekthet kan inte ges från dessa tester. Verktyget kan demonstreras lokalt för en möjlig köpare; verifiering på målplattform och ett verkligt avtal behöver föregå en bindande leverans.

## Underlag till App Store Connect

Följande text är ett utkast att granska mot den slutliga appen:

**Namn:** Sverigevistelseplaneraren

**Undertitel:** Planera dina Sverigedagar

**Beskrivning:** Dokumentera faktiska och planerade vistelser i Sverige. Se inkluderande kalenderdagar, överlapp och hur din plan förhåller sig till en dagbudget som du väljer själv. Granska beräkningen, spara en JSON-backup och exportera vistelser som CSV. Din plan lagras lokalt i appen; konto och automatisk molnsynk ingår inte. Verktyget ger inte juridisk rådgivning och avgör inte skattehemvist eller skattskyldighet.

**Granskningsanteckning:** Ingen inloggning krävs. Tryck Prova med exempel för en demo eller skapa en plan med egen budget. Backupimport valideras och ersätter planen först efter uttrycklig bekräftelse. Filimport och export sker via systemets filväljare. Myndighetskällor öppnas utanför appens privilegierade webbvy.

Utgivaren behöver tillhandahålla Apple Developer-team, slutligt bundle-ID, faktisk supportkontakt och publicerade support-/integritets-URL:er. Därefter behövs appens tillgänglighet, pris/licensbeslut, integritetssvar, innehållsbedömning, trader-uppgifter när tillämpligt, avtal och screenshots från riktiga målplattformar. Ingen fiktiv kontakt eller företagsidentitet ska fyllas i.

## Apple-krav att verifiera vid submission

Apple kräver en färdig, fungerande app och tillräcklig funktion enligt bland annat 2.1 och 4.2. Native filhantering är inte en garanti för godkännande. Samma Sverigeräkning ska inte publiceras som separata identiska appar för olika städer. Support och integritetspolicy ska finnas enligt bland annat 1.5 och 5.1.1. [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).

Integritetssvaren ska baseras på vad slutprodukten faktiskt samlar in och dess eventuella tredjepartstjänster. Lokal bearbetning är inte i sig en insamling till utvecklaren. [App privacy details](https://developer.apple.com/app-store/app-privacy-details/).

Verifiera aktuella SDK-/Xcode-krav när den signerade versionen ska skickas; detta paket har byggts med Xcode 27. [Upcoming requirements](https://developer.apple.com/news/upcoming-requirements/). Utgivaren hanterar [registrering](https://developer.apple.com/programs/enroll/), [avtal](https://developer.apple.com/help/app-store-connect/manage-agreements/sign-and-update-agreements/) och vid behov [trader-uppgifter i EU](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/).

För företagsdistribution kan utgivaren pröva Apples [Custom Apps](https://developer.apple.com/support/volume-purchase-and-custom-apps/). Vid en faktisk försäljning behöver även regler för [appöverföring](https://developer.apple.com/help/app-store-connect/transfer-an-app/overview-of-app-transfer/) och det konkreta avtalet granskas.
