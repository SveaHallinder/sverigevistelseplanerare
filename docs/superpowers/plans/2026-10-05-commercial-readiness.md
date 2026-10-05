# Commercial readiness implementation plan

> Execute independent fixes with explicit file ownership; the root agent owns integration, browser QA and commits.

**Goal:** Harden the existing Sweden-stay tool and prepare a genuinely offline iOS build for review and testing.

**Architecture:** Preserve the approved UI and AppState v1. Browser and iOS use the same JavaScript calculation and import validation. The iOS host supplies local resources and native files through Apple's existing frameworks. Foreign-country rules and city metadata await the user's scope answer.

**Tech stack:** Node 20 built-ins, vanilla ES modules, HTML/CSS, SwiftUI, WebKit and UIKit; no third-party dependency.

## Phase 0 — facts and scope

- [x] Read the current handoff, approved calculation/portability specifications and source/test contracts; record a clean `76039a4` baseline and passing `npm run check` (358 tests).
- [x] Reproduce restore ordering, stale candidate, cancellation, hidden error and midnight defects with `/tmp/product-flow-probe.mjs`.
- [x] Independently check 500 calculation scenarios and five time zones; reproduce derived-year failures and repeated interval expansion with `/tmp/sverige-domain-audit.mjs`.
- [x] Check Apple frameworks and review requirements. Xcode 27 and simulator SDK exist; an available iOS simulator runtime does not.

References: `src/main.js`, `src/controller.js`, `src/domain/{dates,stays,patterns}.js`, `src/ui/data-tools.js`, `test/{ui,controller,dates,stays,patterns}.test.js`, `scripts/build.mjs`; [Apple review requirements](https://developer.apple.com/app-store/review/guidelines/), [local WebKit resources](https://developer.apple.com/documentation/webkit/wkurlschemehandler), [native import](https://developer.apple.com/documentation/uikit/uidocumentpickerviewcontroller).

## Phase 1 — trustworthy data and current date

Files: `src/main.js`, `src/controller.js`, `src/ui/data-tools.js`, `styles.css`, `test/ui.test.js`, `test/controller.test.js`.

- [x] Write failing tests using existing `chooseRestoreFile`, injected readers and controlled Promises: select A then B, finish B before A, confirm only B; select invalid/oversized/unreadable B after valid A and confirm neither; cancel a pending read and prevent its completion from reopening confirmation.
- [x] Clear the old candidate at the start of a new read, show a cancellable reading state, and invalidate superseded/cancelled requests. Pending reads must block mutations and never expose a confirmation button.
- [x] Show file outcomes beside the controls as well as in the live region. Keep the native input out of the tab sequence; preserve the visible restore button.
- [x] Refresh the local date on foreground and user actions. Test midnight, current export filename and passed-plan confirmation without discarding open form drafts.
- [x] Verify with `node --test test/ui.test.js test/controller.test.js`; confirm visible errors and focus in Chrome.

## Phase 2 — date bounds and overlapping intervals

Files: `src/domain/{dates,stays,patterns,budget,budget-explanation}.js`, `src/ui/cockpit.js`, `src/main.js`, `test/{dates,stays,patterns,long-range}.test.js`.

- [x] Write RED cases for the previous month at year 0100, full derived dates beyond year 9999, the last-day interval union, and numerical six-/twelve-month boundaries.
- [x] Fix calendar construction and derived-date comparisons without changing accepted input years, the stored schema, the temporary-break `||` rule, or legal review dates.
- [x] Merge same-status overlapping intervals before expansion. Assert identical day sets and actual precedence, and use a deterministic work bound rather than a flaky elapsed-time test.
- [x] Run `node --test test/dates.test.js test/stays.test.js test/patterns.test.js`; repeat independent reference checks and measure the full cockpit for 100 overlapping fifty-year stays.
- [x] Extend UI budget/preview/explanation to compact interval summaries and year-limited calendar expansion; preserve the expanded library API. Test the full 0100–9999 range without huge day arrays.
- [x] Use interval starts plus March-before-leap candidates for exact rolling maxima. Independent checks passed 1,402 scenarios/30 models plus 3,000 rolling reference cases and 48 tests in each of five time zones.

## Phase 3 — offline native package

Files: `index.html`, `.gitignore`, `src/native-files.js`, `src/main.js`, `native/ios/`, `scripts/build-ios.mjs`, `test/native-tooling.test.js`, native bridge tests.

- [x] Remove automatically fetched external fonts; use the existing system-font fallback.
- [x] Bundle only `index.html`, `styles.css` and `src/` through the existing safe build function. Serve them at a stable local custom origin using `WKURLSchemeHandler` and persistent `WKWebsiteDataStore.default()`.
- [x] Connect native JSON import and file export to the existing validation/confirmation flow. Whitelist the main frame and local origin, limit reading to 1 MiB + 1 byte before validation, handle cancellation explicitly, clean temporary exports, and never interpolate imported content into executable JavaScript.
- [x] Build a shared Xcode scheme for iPhone/iPad with no distribution signing. Provide native app/data information and an app icon; keep seller identity, pricing and account signing unset until supplied.
- [x] Verify resource staging and bridge outcomes with Node tests, then compile with `xcodebuild -project native/ios/Sverigevistelseplaneraren.xcodeproj -scheme Sverigevistelseplaneraren -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`.
- [ ] Test offline first launch, restart persistence, imports/exports and responsive layout on an actual iOS runtime/device. A successful compile is not this acceptance test.

Native Mac QA additionally passed actual JSON import/confirmation, 1 MiB rejection, JSON/CSV export bytes, export cancellation and restart persistence. The missing in-place opening declaration was fixed. An earlier white capture with live AX was not reproduced in a bounded retest; no unsupported frame/reload workaround was introduced. See the detailed QA for the remaining visual/device boundary.

## Phase 4 — review and sale handoff

Files: `docs/qa/localhost.md`, `docs/handoff/CURRENT.md`, `docs/release/readiness.md`, `README.md`.

- [x] Run independent code review, address important findings, and run a fresh serial `npm run check` and `git diff --check`.
- [x] Perform the updated six-step Chrome QA and record exact evidence. Keep real device, user testing, legal verification and store review distinct.
- [x] Prepare accurate capabilities, a buyer demo script, privacy behavior, build instructions and store metadata requirements. Do not invent contracts, prices, customers, copyright ownership, support contacts or approval.
- [ ] Record the user's country/city decision and required publisher/business inputs. Broad correctness and App Store acceptance cannot be inferred from green automated tests.

Product commit: `2c0a8a836646e7a61a4da1bdd7b0e69fb5e88957`; fresh lint/build/417 tests passed. Store/device acceptance and publisher decisions remain unchecked. Sweden-only city-independent calculation is the working assumption while scope clarification is pending; no foreign rules or city schema were added.

## Acceptance boundary

The current tool records inclusive Sweden dates, deduplicates overlap and compares a user-selected budget. It does not determine tax residence or provide foreign-country rules. Verified results must identify inputs/platforms; unsupported or unverified use must remain explicit. No publishing, binding agreements, payment configuration or external communication is performed by this plan.
