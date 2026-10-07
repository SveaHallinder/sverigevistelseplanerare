# Current handoff

Updated: 2026-10-07

## Latest local change: Dynamic Type

The planner now follows iOS Dynamic Type. This continuation fixes the large-text header action container: grid columns previously had no effect on its landscape flex layout; four CSS lines make it a grid only for large native text. Fresh lint, 421 tests and web build pass. Latest unsigned iOS Simulator and Mac Catalyst Release builds pass and all 23 public files match source. The installed iPhone executable matches the new Release artifact. iPhone landscape at Text Size 9 visibly gives Settings the full action row; maximum 11 wraps the heading; normal 3 is restored. The existing synthetic plan still shows 7 of 5 days used after installation, but full-field preservation is not claimed.

VoiceOver activation on the owned iPad showed its system introduction and native heading focus; further keyboard navigation produced a black simulator image of unknown cause. Disabling VoiceOver restored the image; Capture Keyboard is off. Web speech/order remain unverified. Device Hub coordinate actions subsequently failed with `noWindowsAvailable` despite rebinding, raising, zoom-to-fit and centering; AX actions still work. Full landscape date/calendar/large-text interaction, VoiceOver, fresh Catalyst runtime and physical/older-OS acceptance remain open. Durable logs, screenshots and byte-check are in `/Users/admin/Documents/ChatGPT/sverige-qa-20261007/`; see the latest dated section in `docs/qa/localhost.md`.

## Previous verified state

The user will handle App Store publication. The current target is a production-quality local app, including native iPhone/iPad verification; publisher identity, signing, policy URLs and Apple review are not prerequisites for local implementation. Chrome remains the selected browser. Sweden calendar-day calculation applies independently of Swedish city. No foreign-country rules or city/GPS schema are part of the current app.

Release verification started on `634c390`: unsigned iOS device, iOS Simulator and Mac Catalyst Release builds pass with Xcode 27, and all 23 bundled public files match source bytes. The actual Mac Release executable passed saved-plan startup, native invalid-date rejection with a full visible error/footer, exact JSON/CSV export bytes (844/114), real file-chooser restore/confirmation and cold process restart preserving 2/5/6. Evidence: `/tmp/sverige-production-qa-20261006/`; build logs: `/tmp/sverige-production-{ios,simulator,mac}-20261006.log`. That verification used product source `235d2e1`.

Fresh `npm run check` on 2026-10-07 passes lint, 421/421 tests and build. The explicit Release command added to README also builds successfully; its 23 bundled public files match source. Logs: `/tmp/sverige-production-check-20261007.log` and `/tmp/sverige-readme-release-build-20261007.log`.

Previous product commit is `1fd98a0509b651817db8f1bf2b549d6cc7f2f5ae` (`1fd98a0`). The five cited official sources' relevant sections were read on 2026-10-07. Chrome opened both legal-guidance pages after direct reads were rejected; their visible latest-edition links led to 2026.14. Only the two source URLs and review dates changed, with corresponding existing observation-test expectations. No calculation, schema or dependency changed. Fresh lint, 421/421 tests and build pass (`/tmp/sverige-current-source-check-20261007.log`). This text check is not external legal review. Source evidence is in `/tmp/sverige-production-qa-20261007/`; the Release evidence above remains dated to the earlier product source.

Release was rebuilt for all three platforms on `1fd98a0`. The surviving simulator Release artifact is `native/ios/build/Build/Products/Release-iphonesimulator/Sverigevistelseplaneraren.app`. The previous `/tmp/sverige-release-20261007/` and `/tmp/sverige-native-qa-20261007/` evidence directories are no longer available after restart; older temporary paths below are historical, not current evidence.

Native QA resumed on the two isolated devices: `Sverige QA 2026-10-07 iPhone 17` (`374DE328-67E7-44F1-A250-118FEA6AE085`) and `Sverige QA 2026-10-07 iPad A16` (`8E07D48B-6D9A-4539-BD2A-DC8A0DB68397`). Both ran the app in Device Hub on iOS/iPadOS 27. All 23 installed web files match current source. The installed iPhone executable did not byte-match the repository Release artifact; its cause was not established, so exact native executable identity is not claimed. No physical phone or unrelated simulator was modified.

Fresh iPhone cold-device startup preserves budget 5 and 2 actual / 5 planned / 6 unique days; the invalid unsaved date draft is absent. Real local file selection, restore preview, cancel, same-file reselection and confirmed restoration pass. Export cancellation reports that no file was exported. Existing synthetic JSON/CSV files were recovered as 844/114 bytes; this pass does not claim a fresh exact CSV-content check.

Fresh iPad first start shows onboarding. Import through On My iPad restores the synthetic iPhone backup to 2/5/6. Native date selection to arrival 7 / departure 6 rejects saving and opens the departure picker. After closing the picker, the full inline error and save/cancel controls are visible in portrait and landscape; cancel preserves the saved plan. A valid departure change to 5 gives 2/4/5. Selecting and confirming the same local backup then restores 2/5/6 over that changed plan.

Fresh `npm run check` passes lint, 421/421 tests and build. Durable evidence is in `/Users/admin/Documents/ChatGPT/sverige-qa-20261007/`, including `check.log`, iPhone restore/startup images and `ipad-{date-error,landscape-date-error,valid-edit,restored-after-edit}.jpg`. No product change was justified by these observations. iPad subsequently passed local JSON/CSV exports (844/114 bytes, exact match to recovered iPhone files), invalid JSON and 1 MiB+1 rejection with plan preserved, and installation of the repository Release artifact over the existing app. Its executable and all 23 web files now match that artifact exactly; reopening preserves budget 5 and 2/5/6. This tests same-source replacement, not a future version migration. Settings-draft preservation through rejected iPad imports remains untested. VoiceOver, Dynamic Type, iPhone landscape completion, iPhone update preservation and physical/older-OS testing remain open. Continue the six-step native script in `docs/qa/localhost.md`; these passes are not full production acceptance.

The approved Apple iOS 27 runtime is available. The earlier runtime registration was repaired using the verified Apple image; current registered image ID is `CF37BB69-73A3-4AA0-8D7C-936867C7D308` (previous `FFEE6EEE-AE5F-4052-8137-79C9D5A10189` is historical). No certificate or signature checks were disabled. The Mac lock is resolved and no unlock request is pending.

Product commit: `235d2e10fc6b7d088b21077b16be798025c58122` (`235d2e1`) on `design/apple-esque-makeover`; this pass started at `2c13680`. Demo now preserves an unsaved first-plan draft, including blank budget text, voluntary answers and expanded questions. Entry/exit focus is explicit. The close target is 44×44 px, primary hover contrast is 5.57:1, and native date controls fit their fields without stretching the other field when an error is present. No dependency, storage schema or calculation/legal rule changed.

Fresh final `npm run check`: lint, **421 tests** and build pass. Independent read-only review found no actionable issues and passed 147 UI/controller tests; the demo regression was observed RED before the fix. Both unsigned native builds pass; all 23 public files match source in `dist/` and both bundles.

Chrome source and built origins proved draft/demo preservation, validation/focus, empty state and 2/5/6 actual/planned/unique days. Final date CSS now also passes invalid-date layout at 320×667, 390×844, 667×375, 768×1024 and 1440×900. The expanded dialog's save footer remains visible in landscape. Actual 200-percent Chrome zoom was selected through the browser menu and verified as 766 CSS-px width / DPR 4 from 1532 / DPR 2. Validation, editing to 2/4/5, preserved settings draft through invalid JSON, real file-chooser restore blocking/cancel/reselect/confirmation and reload back to 2/5/6 pass at that zoom, with no console errors/warnings. Zoom and viewport overrides are reset.

Mac previously proved status editing, native JSON/CSV export bytes and restore to 2/5/6. The final invalid-date state is now visually verified too: native picker selection to 7/6 October, rejected save, correct departure focus, aligned/unclipped controls and visible error/footer. Cancel preserves 2/5/6. All three remaining layout checks are complete; no product change was needed in this verification pass. A fresh check again passes 421 tests, lint and build, and all 23 public files still match source in `dist/` and both native bundles.

Chrome reconnected in a new test tab after the old tab was closed. Fresh restore used the earlier byte-verified native backup; the latest Chrome download event timed out after visible success copy, so no fresh exported-byte check is claimed. Its internal downloads URL was rejected by the tool policy and not bypassed. Mac captures again initially showed a white body/no-window error before the full error-state image succeeded; the cause remains unknown. Do not call that observation fixed. Evidence is in `/tmp/sverige-final-qa-20261006/` and `docs/qa/localhost.md`. Real participant usability testing remains unperformed. The app is locally buildable and demoable; a perfect UX rating is not an observed fact.

Use `npm run dev` or build plus `npm run preview`; the current built QA server is `http://127.0.0.1:56155/` while its process is running. Follow the six-step script in `docs/qa/localhost.md`. Preserve AppState v1, the existing UI structure and the previously verified interval math. Store/device notes below are historical evidence and the user's publishing handoff, not permission questions for continued local development.

## Previous hardening state (2026-10-05)

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

1. The final local viewport/zoom and native error-state visual checks passed on 2026-10-06. Try the six-step flow with real users; participant testing remains open. Do not expand dependencies or schema to polish the current UI.
2. For the native target, verify the exact build on iPhone/iPad, including dates, restart/update, VoiceOver, Dynamic Type and file providers. Keep signed sandbox and the white-capture observation explicit. Safari/Firefox remain a separate future web compatibility matrix.
3. The user owns store publication and business inputs. Support/privacy pages, metadata/screenshots, rights/license and commercial decisions belong to that handoff before a binding sale or submission; do not block local improvements on them. The buyer demo and draft requirements are in `docs/release/readiness.md`. Remaining source/legal review must not be presented as completed.
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
Läs CLAUDE.md och docs/handoff/CURRENT.md. Användaren hanterar App Store-publiceringen; fortsätt med den lokala appens konkreta UX- och funktionskontroller enligt QA från 2026-10-06. Kör npm run check först. Bevara AppState v1 och den godkända UI-strukturen, och inför inte nya beroenden eller schemaändringar utan beslut.
```

## Handoff back to Codex

After Claude reports completion, ask Codex to review the entire diff and commits against both active specs. Codex should run tests independently, challenge restore pre-write and partial-write failure semantics, CSV determinism, escaping, legal copy, boundary dates, demo blocking, storage conflicts and browser focus behavior before accepting the work.
