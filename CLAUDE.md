# Claude Code project instructions

## Mission

Build a functionally trustworthy Sweden-stay planner for people who have already moved abroad. Preserve the existing local-first MVP, harden date/legal calculations, then add safe local backup/restore and deterministic CSV export. Visual redesign is explicitly deferred.

This is a planning tool, not legal advice. It must never declare tax residence, tax liability, legal safety, or a date when someone "must leave Sweden".

## Session startup

Do this before the first edit:

```bash
git status --short
git branch --show-current
git log -1 --oneline
npm run check
```

If the worktree is clean and the current branch is `dev`, create and switch to:

```bash
git switch -c claude/functional-hardening-export
```

Then read, in this order:

1. `CLAUDE.md`
2. `docs/handoff/CURRENT.md`
3. `docs/superpowers/specs/2026-08-16-functional-hardening-design.md`
4. `docs/superpowers/plans/2026-08-16-functional-hardening.md`
5. `docs/superpowers/specs/2026-08-16-local-data-portability-design.md`
6. `docs/superpowers/plans/2026-08-16-local-data-portability.md`
7. The exact source and test files named by the current task

Do not dump every large file into context at once. Inventory with `rg --files`, locate symbols with `rg -n`, then read each task's complete relevant functions and neighbouring tests before editing.

## Authority order

When documents disagree, use this order:

1. Current source code and green tests
2. `docs/handoff/CURRENT.md` and the two new sprint specs/plans
3. The implemented MVP design spec
4. The historical MVP implementation plan
5. README prose

The old MVP implementation plan is intentionally preserved as history. Its unchecked boxes and code snippets are not instructions to rebuild the app.

## Locked product scope

- User is already moved abroad.
- Count and plan Sweden stays only.
- Do not model days in the tax-residence country or other countries.
- The day budget is entered by the user. It is not a legal threshold or safe harbour.
- Mathematical calculations and legal observations stay separate.
- Actual history and planned scenarios stay visibly separate.
- Unregistered dates mean only "not registered", never proven foreign presence.
- Official legal sources and `reviewedAt` remain visible for every legal observation.
- Local-first only. No account, backend, database, telemetry, analytics, AI advice, cloud sync or reminders in these two plans.
- No visual redesign. Add only compact functional controls and disclosures using existing components.

## Engineering rules

- Node.js 20+, vanilla ES modules, semantic HTML and CSS. No dependency without explicit user approval.
- Do not change persisted `AppState` version 1 or `STORAGE_KEY` without explicit user approval.
- Reuse existing modules before adding new abstractions.
- Follow TDD for every behavior change: targeted RED, minimal GREEN, then cleanup.
- Change the smallest possible set of files. No unrelated refactor.
- Preserve existing user changes and unrelated dirty files.
- Never log profile data, checklist answers, travel dates, serialized state or imported file content.
- Runtime code under `src/` may not call `console`.
- External links require `rel="noopener noreferrer"` and official legal claims use primary sources only.
- Do not use `window.confirm`; confirmations are inline and keyboard accessible.
- Keep dynamic HTML escaped.
- Run builds serially. Parallel builds can race on `dist/`.

## Git workflow

- Make one atomic commit per completed plan task.
- Use explicit paths with `git add`; never `git add .` or `git add -A`.
- Never amend, squash, rebase, force-push or delete branches unless the user asks.
- Do not push or open a PR. Leave reviewable local commits for Codex.
- Before each commit run the targeted tests and `git diff --check`.
- Before completion run one fresh, serial `npm run check`.

## Do not ask questions that the repository answers

Inspect the source, tests, current handoff and official linked source first. Choose the existing code style and the exact contracts in the active plan.

Stop and ask only if one of these occurs:

1. A new dependency is genuinely required.
2. The persisted AppState/storage schema must change.
3. A requested legal behavior conflicts with a current primary source and the active spec does not resolve it.
4. Completion requires destructive Git, external publishing, credentials or a scope expansion outside the active plans.
5. The worktree contains overlapping user edits that cannot be preserved safely.

For ordinary test failures, implementation details, filenames, copy already specified in the plan or discoverable APIs: diagnose and continue.

## Completion contract

Do not claim completion until all are true:

- every active-plan checkbox is checked,
- targeted tests passed after each task,
- `npm run check` passed from the final tree,
- `git diff --check` passed,
- localhost QA was run from `docs/qa/localhost.md`,
- only planned files changed,
- docs match what actually shipped,
- the worktree is clean after atomic commits.

Finish with this exact evidence shape for Codex review:

```text
STATUS: COMPLETE | BLOCKED
BRANCH: <branch>
COMMITS: <sha subject, one per line>
FILES: <changed files grouped by commit>
RED: <failing tests observed before implementation>
GREEN: <targeted tests and final npm run check counts>
QA: <localhost steps and result>
LEGAL SOURCES: <URLs/review dates changed or "unchanged">
KNOWN RISKS: <specific remaining risks or "none identified">
```
