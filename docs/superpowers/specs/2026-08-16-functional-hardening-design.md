# Functional hardening design

Date: 2026-08-16

Status: Approved for implementation

## Goal

Make the existing date, budget and legal-observation behavior easier to verify and understand without broadening the legal scope or redesigning the UI.

## Scope

This phase adds source-backed scenario fixtures, closes missing boundary/state tests, displays the first registered date over budget, exposes existing pattern facts, and adds a deterministic explanation of how the personal budget was calculated.

It does not add a new legal threshold, foreign-country rules, automated legal conclusions, account infrastructure or a visual redesign.

## Legal safety boundary

- The personal budget is always described as user-entered planning data.
- `lastWithinBudgetDate` is labelled "senaste registrerade dag inom budget", never "last safe day" or a required departure date.
- `firstExceededDate` is labelled "första registrerade dag över budget".
- Pattern outputs are facts or observations requiring individual assessment.
- Actual history and planned scenarios remain separate.
- No legal change is made without a primary official source and a regression fixture carrying its source ID and review date.

Verified primary sources for this phase:

- Inkomstskattelagen 3 kap. 3 och 7 §§: <https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/inkomstskattelag-19991229_sfs-1999-1229/>
- Skatteverket, stadigvarande vistelse: <https://www4.skatteverket.se/rattsligvagledning/edition/2026.7/2637.html>
- Skatteverket, 183-dagarsregeln i SINK: <https://www.skatteverket.se/privat/etjansterochblanketter/svarpavanligafragor/sink/sink/vadar183dagarsregelnisinkochvadinnebarden.5.5b35a6251761e6914206793.html>

## Calculation contract

A new pure explanation model derives, but never persists:

- budget period and personal budget,
- actual, planned, unique and overlapping registered days,
- included registered ranges and excluded ranges,
- remaining days or days over budget,
- latest registered date within budget,
- first registered date over budget,
- actual presentation precedence on overlap,
- actual and actual-plus-planned visit count, total registered days, longest merged stay and exact unregistered gaps,
- fixed copy that arrival/departure are inclusive and overlap counts once for the budget.

The explanation calls existing `calculateBudget`, `getStayDaySets` and `calculatePatternFacts`; it must not create a competing calculation implementation.

## State invariant

`validateAppState` must reject `profile: null` with non-empty `stays`. Hidden stays without a profile would be unsafe once restore exists. Empty state with `profile: null` and `stays: []` remains valid.

## Boundary matrix

Automated tests cover:

- same-day interval,
- year boundary and leap day,
- dates around daylight-saving transitions,
- both budget-period endpoints,
- candidate wholly outside the budget period,
- actual/planned overlap with actual display precedence,
- exact budget, first exceeded date and already exhausted budget,
- edit preview excluding the old interval,
- non-contiguous registered dates ranked chronologically,
- five-year clamping,
- six-month stay boundary,
- temporary gap no longer than either neighbour and below six months,
- gap reaching six months,
- rolling twelve-month inclusive boundary.

## UI integration

Use one compact native `<details>` disclosure titled "Så räknas planen" in the existing cockpit. Render the first exceeded date in the current budget status. Reuse existing typography, card and focus patterns. Dynamic values are escaped, keyboard interaction is native, and the summary meets the existing 44 px target policy.

## Definition of done

- Source-backed fixtures distinguish `||` from the stale historical `&&` rule.
- Existing mathematical outputs remain green or change only after a deliberate failing fixture.
- The explanation model is pure, deterministic and not persisted.
- The UI shows both boundary dates when relevant and never labels either legally safe.
- The promised visit/pattern facts are visible as facts, not conclusions.
- `npm run check` and the updated localhost QA pass.
