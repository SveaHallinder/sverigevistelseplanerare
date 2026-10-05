# Current handoff

Updated: 2026-10-05

## Current state

Product commit: `2c0a8a836646e7a61a4da1bdd7b0e69fb5e88957` (`2c0a8a8`) on `design/apple-esque-makeover`. Baseline was `76039a4`. Fresh `npm run check` passes lint, 417 tests and build; the staged product diff passed `git diff --check`. No third-party dependency, persisted schema, cloud service, payment flow or legal rule was added.

The current hardening fixes restore races, stale confirmation candidates, visible file feedback, preserved profile drafts and foreground/local-day refresh. Numerical date arithmetic handles the accepted 0100–9999 bounds and derived dates beyond them. Budget/preview/explanation and rolling-window facts use compact intervals in the UI; the calendar expands only its selected year. The expanded library API remains available. Do not undo the full-range regression or the leap-year rolling-window candidate.

Calculation review passed 1,402 independent cases plus 30 model checks, a separate 3,000-case rolling reference and 48 tests in each of five time zones. The 0100–9999 stay rendered and previewed in Chrome without expanding its 3,615,900 days. These are mathematical checks, not legal acceptance. The temporary-break `||` rule and `reviewedAt` are unchanged.

Final `dist/` Chrome QA on port 4175 passed first-start demo, empty-budget validation/focus, new profile/empty state, actual/planned overlap, invalid departure, editing, unsaved profile draft through invalid file, restore blocking/cancel/reselect/confirmation, year navigation and reload. Counts are 2 actual / 5 planned / 6 unique after restoring the canonical synthetic plan. No app console errors/warnings were observed. The same public source passed 320/390/768/1440 px checks on the separate 4176 origin.

An offline native iPhone/iPad prototype now exists under `native/ios/`; `node scripts/build-ios.mjs` compiles an unsigned generic iOS Simulator bundle. `--catalyst` compiles a local Mac test host. Both passed with Xcode 27, and all 23 public web files matched source bytes in both bundles and `dist/`. Mac UI proved native JSON import/confirmation, oversized-file rejection, JSON/CSV export bytes, export cancellation, native data information and restart persistence. Final clean Catalyst relaunch also displayed the saved plan. One earlier white screenshot with functioning AX was not reproduced in the bounded retest; geometry was positive/attached/visible and no layout patch was justified. This observation remains documented; temporary instrumentation was removed.

No usable iOS simulator runtime or distribution identity was present. Download/install approval for Apple's runtime and the actual publisher/team/support/privacy inputs were asked asynchronously and are still pending. Do not silently download several GB, fabricate seller identity or policy URLs, or treat compile/Mac QA as signed iPhone/iPad or App Store acceptance. The default scope remains Sweden days in any Swedish city; foreign-country rules and city metadata were not invented while the scope question awaits a reply.

Read `docs/qa/localhost.md` for the six-step QA and exact boundaries, `docs/release/readiness.md` for the buyer demo and store draft, and `docs/superpowers/plans/2026-10-05-commercial-readiness.md` for completed and pending gates. Real usability testing, actual 200-percent zoom, signed target devices/providers, two full official legal pages, legal review and Apple review remain open. The local package is reviewable and demoable; it is not an approved or live store release.

## Previous local UX and file QA (2026-09-07 to 2026-10-05)

The approved local launch UX is implemented on `design/apple-esque-makeover`, with no dependency, storage schema or legal calculation changes. Month view opens on the budget period (or today within it); year view is optional. Registered days open an editor or an overlap chooser. Mobile shows stays before the calendar. Onboarding requires an actively chosen budget; previews explain new unique days, overlap and excluded dates. Local storage and backup are visible in the overview.

The follow-up UI polish gives remaining/over-budget days visual priority, keeps three compact summary counts, moves registered boundary dates into the calculation disclosure, and increases muted text contrast. Stay previews show the balance and excluded-date notice immediately, with arithmetic under a disclosure. The form scrolls independently of its save footer; changing status restores focus to the checked radio.

The final interaction pass fixes native date segment focus: changing a month no longer replaces the input and moves editing to its year segment. Only the preview updates, preserving expanded calculation details. Validation focuses the first invalid input. Local-storage onboarding guidance is available to assistive technology and remains visible on mobile; validation text has higher contrast.

Current checks: `npm run check` passes lint, 358 tests and build. Chrome localhost checks cover onboarding, demo, overlap editing, confirmation cancellation, persistence, calendar navigation and responsive layout. The polished overview has no horizontal overflow at 320–1600 px; the save footer remains visible at 667×375 with expanded calculation details. The built copy on port 4174 has also passed onboarding, budget validation, empty state and actual/planned overlap registration.

On 2026-10-05, the built copy on port 4175 passed real JSON/CSV downloads and file-chooser restore in Chrome with synthetic data. Downloaded bytes match canonical AppState v1 and the expected CSV. Pending restore blocks adding stays, settings and calendar editing with Enter. Cancel preserves data and returns focus; selecting the same file again works. Reload before confirmation preserves the edited plan, confirmation restores the backup, and reload after confirmation preserves the restored plan. Invalid JSON shows a clear error and leaves data unchanged through reload. No runtime changes were needed; the tested product commit is `30d7cd3`.

The user selected Chrome for this local work; Safari automation is not a prerequisite. See `docs/qa/localhost.md` for precise results, the five-task usability script and remaining manual checks. No real participant usability test has been performed. Actual 200-percent zoom, Safari/Firefox, real iPhone and two official legal sources remain unverified.

## Historical sprint state (2026-08-17)

Both sprint plans are implemented, verified and committed locally on branch `claude/functional-hardening-export`. The local-first MVP now also explains its own arithmetic and supports local JSON backup/restore plus deterministic CSV export. No dependency, backend, cloud, analytics, persisted schema change or visual redesign was introduced.

Verification from the final tree:

- `npm run check`: lint, 332 tests and build passed
- localhost QA: 7/7 passed with no console errors and no failed requests
- responsive checks: 375 px, a 200 percent reflow equivalent and 1280 px passed without horizontal overflow
- keyboard flow: calendar roving focus, native disclosure toggle, dialog focus return and inline destructive confirmations passed
- storage modes: local, session and memory behavior remain covered by tests
- a forced post-write storage conflict was reproduced in a real browser and the persisted layers genuinely diverged, matching the partial-write warning copy

The earlier UI deferral was superseded by the user's approved local launch plan on 2026-09-07. Preserve the new structure and styles unless a concrete issue requires a small fix.

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
| Browser/native file bridge | `src/native-files.js` |
| Native local resources, file access and SwiftUI host | `native/ios/Sverigevistelseplaneraren/` |
| Native resource staging and unsigned builds | `scripts/build-ios.mjs` |
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

Remaining, in this order:

1. Resolve the pending iOS runtime/install and publisher inputs, then test the exact build on iPhone/iPad, including dates, restart/update, VoiceOver, Dynamic Type and file providers. Keep signed sandbox and the documented white-capture observation in that acceptance pass.
2. Try the local beta with users using the six-step script in `docs/qa/localhost.md`, and complete the remaining zoom and source/legal review. Chrome file QA is complete; Safari/Firefox is a separate future compatibility matrix.
3. Complete real support/privacy pages, metadata/screenshots, rights/license and commercial decisions with the actual owner before a binding sale or store submission. The buyer demo and draft requirements are in `docs/release/readiness.md`.
4. Account and cloud sync only after a separate product decision. Web Storage limits documented below are the reason multi-device synchronization cannot be faked locally.

Nothing here is deployed and no external legal review has been performed. The local UI work does not authorize new backend infrastructure.

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
- While a restore preview is pending the controller blocks every mutation, and the browser layer additionally refuses to open the stay dialog or the profile form. Both announce the same reason instead of opening a form that would be refused on submit. The guard sits in `openStay`, so any future dialog entry point inherits it.

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
Läs CLAUDE.md och docs/handoff/CURRENT.md. Tidigare sprintar och den lokala hårdsäkringen är implementerade. Kör npm run check först och fortsätt enligt den aktuella planen från 2026-10-05: native målplattforms-QA och faktiska publiceringsuppgifter återstår. Bevara AppState v1 och den godkända UI-strukturen.
```

## Handoff back to Codex

After Claude reports completion, ask Codex to review the entire diff and commits against both active specs. Codex should run tests independently, challenge restore pre-write and partial-write failure semantics, CSV determinism, escaping, legal copy, boundary dates, demo blocking, storage conflicts and browser focus behavior before accepting the work.
