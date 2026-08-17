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

## Data och MVP-gräns

Data sparas lokalt i den aktuella webbläsaren. Rensa all lokal appdata genom att klicka på **Rensa all data** i UI:t och bekräfta rensningen.

Cockpiten visar hur registrerade dagar, överlapp, exkluderade datum och personliga budgetgränser har räknats.

Under "Din data" kan användaren ladda ner en lokal JSON-backup, återställa en validerad backup efter uttrycklig bekräftelse och exportera vistelser som CSV. Filerna skickas inte till en server.

Verktyget fastslår inte skattehemvist eller juridisk säkerhet och ersätter inte individuell juridisk rådgivning. Konto och molnsynk ingår inte i MVP:n.

## Fortsatt utveckling med Claude

Claude Code läser [CLAUDE.md](CLAUDE.md) automatiskt. Aktuellt nuläge, läsordning och nästa arbete finns i [docs/handoff/CURRENT.md](docs/handoff/CURRENT.md).

Nästa arbete är uppdelat i två körbara planer:

1. [Funktionell och juridisk hårdsäkring](docs/superpowers/plans/2026-08-16-functional-hardening.md)
2. [Lokal backup, återställning och CSV-export](docs/superpowers/plans/2026-08-16-local-data-portability.md)

Referenser:

- [Aktuellt localhost-QA](docs/qa/localhost.md)
- [Implementerad MVP-design](docs/superpowers/specs/2026-08-16-sverigevistelseplanerare-design.md)
- [Historisk MVP-plan](docs/superpowers/plans/2026-08-16-sverigevistelseplanerare-mvp.md)

Starta `claude` i repots rot och skriv:

~~~text
Läs CLAUDE.md och docs/handoff/CURRENT.md. Kör NEXT_WORK i angiven ordning, testdrivet och med atomiska commits. Fråga bara om ett dokumenterat stopvillkor inträffar.
~~~
