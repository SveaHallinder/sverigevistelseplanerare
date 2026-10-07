# Produktstatus och lanseringsunderlag

Uppdaterat 2026-10-07 med Release-kontroller, källuppdatering och installerad simulatorruntime. Målet är en produktionsapp lokalt. Publiceringsunderlaget från 2026-10-05 är oförändrat. Detta är ett granskningsbart lokalt produktpaket, inte ett besked om juridisk korrekthet eller godkänd distribution. Användaren hanterar App Store-publiceringen; utgivaruppgifter och signering är separata från den lokala appens arbete.

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
| Webb i Chrome | Inmatning, överlapp, datumfel, backupförhandsvisning, sparande och omladdning; slutlig datum-CSS vid 320/390/667/768/1440 px samt riktig 200 % zoom utan sidöverflow, med synlig sparrad och fungerande redigering/filåterställning | Verkliga användartester, slutlig kompatibilitetsmatris; senaste exportfilerna är inte byteverifierade enligt det daterade QA-protokollet |
| Native Mac Catalyst | Release kompilerar och kör appens lokala origin; datumfel, riktig JSON-import/bekräftelse, JSON/CSV-export med exakt filinnehåll och plan efter kall omstart verifierade i Release. Tidigare Debug-pass omfattar också storleksavvisning och exportavbrott | Signerad sandbox/provider; återkommande vit fångst med okänd orsak enligt QA-protokollet |
| Native iPhone/iPad | Installerade webbfiler matchar `1fd98a0`. iPhone kallstart, lokal import/avbryt/återval/bekräftelse; iPad första start, import, datumfel i porträtt/landskap, giltig redigering till 2/4/5 och återställning till 2/5/6 | VoiceOver, Dynamic Type, slutförd iPhone-landskapskontroll, iPad-export och ogiltig/stor import, uppdateringsbevarande, fysisk/äldre OS-matris; exakt native-exekverbaridentitet är inte bekräftad |
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
