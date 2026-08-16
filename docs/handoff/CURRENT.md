# Current handoff

Updated: 2026-08-16

## Current state

The local-first MVP is complete. Baseline commit `5d9b48f` prevents stale tabs from silently overwriting a newer local or session save. The final independent review found no Critical or Important issue. The final browser QA passed all six documented flows with no console errors.

Baseline verification before this handoff:

- `npm run check`: lint, 274 tests and build passed
- localhost QA: 6/6 passed
- responsive checks: 375 px and a 200 percent reflow equivalent passed without horizontal overflow
- keyboard flow: calendar roving focus, dialog focus return and inline destructive confirmations passed
- storage modes: local, session and memory behavior are covered by tests

The current UI is intentionally not the next priority. Keep its structure and styles unless a new functional control needs the smallest possible addition.

## Product in one paragraph

The user has already moved from Sweden and records actual or planned stays in Sweden. The app counts inclusive calendar dates, deduplicates overlap for the personal budget, shows actual and planned counts separately, calculates registered-day budget boundaries, and raises neutral source-linked observations. It does not determine residence, tax liability, foreign-country compliance or legal safety.

## Important source-of-truth correction

The historical MVP spec once said a possible temporary interruption required a gap no longer than both neighbouring Sweden stays. Current code and tests correctly use a gap that does not reach six months and is no longer than either the preceding or following stay. This matches Skatteverket's examples, including the asymmetric 2-month / 3-month / 4-month case.

Do not revert `src/domain/patterns.js` from `||` to `&&`. The old MVP plan is historical and contains stale snippets.

Primary source: <https://www4.skatteverket.se/rattsligvagledning/edition/2026.7/2637.html>

## Architecture map

| Area | Source of truth |
|---|---|
| UTC calendar arithmetic | `src/domain/dates.js` |
| Actual/planned/unique dates and merged intervals | `src/domain/stays.js` |
| Personal budget and candidate preview | `src/domain/budget.js` |
| Six-month, gap and rolling-window facts | `src/domain/patterns.js` |
| Neutral legal observations | `src/domain/observations.js` |
| AppState v1 validation and normalization | `src/domain/validation.js` |
| Immutable mutations | `src/domain/state.js` |
| Canonical JSON serialization and safe persistence | `src/storage.js` |
| Use cases | `src/controller.js` |
| Browser event and focus wiring | `src/main.js` |
| Markup | `src/ui/` |
| Official source metadata | `src/legal-content.js` |
| Regression contracts | `test/` |

## NEXT_WORK

Execute these plans in order. Finish and commit every task in plan 1 before plan 2.

1. `docs/superpowers/plans/2026-08-16-functional-hardening.md`
2. `docs/superpowers/plans/2026-08-16-local-data-portability.md`

Plan 1 locks source-backed legal scenarios, tightens date/state edge cases and exposes an exact explanation of the existing calculation. Plan 2 adds canonical AppState v1 JSON backup/restore and deterministic CSV stay export without adding a backend or changing stored schema.

## Locked next-sprint decisions

- `lastWithinBudgetDate` means the chronologically last registered date that fits the user's budget. It is not a continuous-permission deadline.
- `firstExceededDate` means the first registered date ranked beyond the user's budget. Show both when applicable.
- A backup file is the existing canonical AppState v1 JSON from `serializeAppState`. Do not invent a wrapper envelope or a second version schema.
- Import validates with `decodeStoredState` before any write and replaces state only through `repository.save` after an explicit inline confirmation.
- Invalid import, unsupported version and cancelled confirmation happen before `repository.save` and leave current in-memory and persisted data unchanged.
- A failed `repository.save` leaves the controller's current state unchanged, but an underlying Web Storage conflict can occur after one persistent layer was written. Keep the restore preview, publish the blocking issue and explicitly warn that stored bytes may have changed.
- A state with `profile: null` and non-empty `stays` is invalid before restore ships.
- CSV is export-only. Columns are `ankomstdatum,avresedatum,status,kalenderdagar`; no profile answers, internal IDs or timestamps.
- CSV uses lowercase `faktisk` / `planerad`, inclusive day counts, RFC 4180 quoting and CRLF lines.
- Empty CSV codec output is header-only; UI does not download it and announces that no stays exist.
- Restore is available from onboarding so a fresh browser can recover a backup; downloads require a real profile.
- Export remains available in local, session and memory modes. Demo blocks export and restore.
- Import files over 1 MiB are rejected before reading with neutral Swedish copy. This is a local resource guard, not a legal date limit.
- Use injected file reading and downloading in browser tests. Revoke object URLs and allow selecting the same file again.

## Known storage limits deliberately not expanded

Web Storage has no atomic compare-and-set. The repository detects a stale tab during its synchronous preflight, but another write could theoretically occur between that read and `setItem`. There is no `await` in that window and the risk was judged acceptable for human-triggered MVP writes. Do not migrate to IndexedDB or Web Locks in these plans.

Writes across local and session storage are also not transactional. Existing tests prove that a local candidate can be written before session neutralization fails and `repository.save` returns `storage-conflict`. Restore must characterize this real path, keep the old controller state plus preview, show a blocking partial-write warning and instruct cancel, reload and, if the warning remains, clear/reselect. Never claim that every failed save preserved persistent bytes.

## Start command

From this directory:

```bash
claude
```

Paste:

```text
Läs CLAUDE.md och docs/handoff/CURRENT.md. Kör NEXT_WORK end-to-end i angiven ordning. Börja med baseline npm run check, arbeta testdrivet, gör atomiska lokala commits och fråga endast om ett uttryckligt stopvillkor i CLAUDE.md inträffar. Ändra inte designen, AppState v1 eller dependencies.
```

## Handoff back to Codex

After Claude reports completion, ask Codex to review the entire diff and commits against both active specs. Codex should run tests independently, challenge restore pre-write and partial-write failure semantics, CSV determinism, escaping, legal copy, boundary dates, demo blocking, storage conflicts and browser focus behavior before accepting the work.
