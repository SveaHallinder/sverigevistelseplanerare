# Current handoff

Updated: 2026-08-17

## Current state

Both sprint plans are implemented, verified and committed locally on branch `claude/functional-hardening-export`. The local-first MVP now also explains its own arithmetic and supports local JSON backup/restore plus deterministic CSV export. No dependency, backend, cloud, analytics, persisted schema change or visual redesign was introduced.

Verification from the final tree:

- `npm run check`: lint, 332 tests and build passed
- localhost QA: 7/7 passed with no console errors and no failed requests
- responsive checks: 375 px, a 200 percent reflow equivalent and 1280 px passed without horizontal overflow
- keyboard flow: calendar roving focus, native disclosure toggle, dialog focus return and inline destructive confirmations passed
- storage modes: local, session and memory behavior remain covered by tests
- a forced post-write storage conflict was reproduced in a real browser and the persisted layers genuinely diverged, matching the partial-write warning copy

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
| Pure explanation of the budget calculation | `src/domain/budget-explanation.js` |
| Backup/CSV codecs | `src/data-transfer.js` |
| Calculation disclosure markup | `src/ui/budget-explanation.js` |
| Backup, restore and export controls | `src/ui/data-tools.js` |
| Regression contracts | `test/` |

## COMPLETED_WORK

Both plans are finished and every checkbox is checked.

1. `docs/superpowers/plans/2026-08-16-functional-hardening.md`
2. `docs/superpowers/plans/2026-08-16-local-data-portability.md`

Commits on this branch, oldest first:

```text
b8f3cb1 test: lock source-backed legal scenarios
cbec6a4 fix: reject hidden stays without a profile
36b54e1 feat: explain personal budget calculations
b79937f feat: show how registered days are calculated
50ff974 docs: verify functional calculation hardening
6645088 feat: encode local backups and stay exports
089c8b8 feat: restore local data with conflict handling
5992878 feat: add local backup and export controls
```

Test count went from 274 to 332.

## Deliberate deviations from the written plans

Both are recorded here because the plans specified them differently.

1. The `profile: null` with non-empty `stays` invariant is checked **after** stay validation, not "immediately after the root shape guard". The plan's placement would have changed the message of 14 existing green assertions in `test/validation.test.js` whose purpose is stay validation. Placing it after the stay loop rejects exactly the same states, because an individually invalid stay is already rejected first. Green tests outrank plan prose in the `CLAUDE.md` authority order.
2. `test/state.test.js` was edited even though Task 2 did not list it. One assertion claimed that `addStay` on a profile-less state yields a valid `AppState`, which the new invariant deliberately inverts. The assertion now injects a profile so it still proves `addStay` produces a canonically persistable shape. `controller.saveStay` already refuses to add a stay without a profile, so the profile-less combination is unreachable in the product.

Two smaller judgement calls: the disclosure uses `min-height: 2.75rem` instead of the plan's `44px` to match the existing rem-based target-size idiom (identical computed value), and the explanation's day copy reuses the repo's singular/plural `dayWord` rule so it renders "1 dag över" instead of the plan snippet's "1 dagar över".

## Remaining product roadmap

Not started, in this order:

1. Account and cloud sync, including any real multi-device conflict resolution. Web Storage limits documented below are the reason this cannot be faked locally.
2. Visual redesign, last.

Neither is in scope for the two completed plans. Nothing here is deployed and no legal review has been performed.

## Locked decisions, now implemented and covered by tests

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

Writes across local and session storage are also not transactional. Existing tests prove that a local candidate can be written before session neutralization fails and `repository.save` returns `storage-conflict`. Restore characterizes this real path in `test/storage.test.js`, keeps the old controller state plus preview, shows a blocking partial-write warning and instructs cancel, reload and, if the warning remains, clear/reselect. Never claim that every failed save preserved persistent bytes.

This path was also reproduced manually in a real browser: after a forced session-write failure, `localStorage` held the restored candidate while `sessionStorage` still held the previous state, the reload then locked instead of silently choosing a layer, and clear followed by reselect recovered.

## Start command

From this directory:

```bash
claude
```

Paste:

```text
Läs CLAUDE.md och docs/handoff/CURRENT.md. Båda sprintplanerna är klara. Gör ingen ny funktionalitet utan att jag ber om det. Om du ska fortsätta: kör npm run check först och läs avsnittet om avvikelser och kvarvarande roadmap.
```

## Handoff back to Codex

After Claude reports completion, ask Codex to review the entire diff and commits against both active specs. Codex should run tests independently, challenge restore pre-write and partial-write failure semantics, CSV determinism, escaping, legal copy, boundary dates, demo blocking, storage conflicts and browser focus behavior before accepting the work.
