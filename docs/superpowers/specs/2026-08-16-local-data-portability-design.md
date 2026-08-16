# Local data portability design

Date: 2026-08-16

Status: Approved for implementation after functional hardening

## Goal

Let a local-first user make a lossless JSON backup, safely restore it, and export a deterministic CSV stay log before account or cloud work exists.

## Scope

This phase adds three functions:

1. Download canonical AppState v1 JSON.
2. Preview, explicitly confirm and restore canonical AppState v1 JSON through the existing repository with explicit conflict reporting.
3. Download a deterministic CSV containing only stay intervals.

No account, backend, database, encryption claim, cloud sync, sharing link, PDF or automatic import is added.

## JSON contract

The JSON backup is exactly the normalized value produced by existing `serializeAppState(state)`. Its existing top-level `version: 1` is the format version. No envelope, export timestamp, derived total, legal observation or second schema is introduced.

`decodeStoredState(raw)` is the canonical parser and validator. Import-specific code maps its issue codes to neutral user-facing messages without echoing file content or personal values.

A valid JSON backup round-trips byte-identically for the same normalized state.

## Restore flow

1. User chooses a local `.json` file no larger than 1 MiB.
2. The browser reads it as text.
3. The controller validates it without changing current state or storage.
4. UI shows filename, whether a profile exists and number of stays.
5. User confirms or cancels inline.
6. Confirmation calls existing `repository.save(candidateState)`.
7. Only a successful save replaces controller state and closes the preview.

Invalid JSON, invalid state, unsupported version, demo mode, cancellation and an already-blocking storage issue stop before `repository.save` and leave controller state and stored bytes unchanged. A failed repository save leaves controller state unchanged and keeps the preview, but Web Storage is not transactional: one persistent layer may already contain the candidate when neutralizing another layer fails. That path must publish a blocking issue and say that the backup may have been written partially. Restore never writes directly to Web Storage and never clears first.

## CSV contract

Encoding is UTF-8 text with RFC 4180 quoting and CRLF line endings:

```text
ankomstdatum,avresedatum,status,kalenderdagar\r\n
```

Rules:

- one row per stored stay interval,
- fixed lowercase status `faktisk` or `planerad`,
- inclusive `kalenderdagar` from existing `daysInclusive`,
- sort by arrival date, departure date, actual before planned,
- identical semantic input produces identical bytes,
- no profile answers, checklist data, internal ID, created/updated timestamp or derived legal data,
- codec returns header-only for no stays; UI announces the empty case and does not download.

Because every exported cell is an ISO date, fixed status or integer, no user-controlled spreadsheet formula cell is emitted.

## Controller and browser boundary

Pure codecs live in `src/data-transfer.js`. The controller owns demo/storage blocking, preview state, explicit confirmation, repository-mediated persistence and honest partial-write conflict reporting. Browser-only code owns `File.text()`, `Blob`, object URLs, download clicks, URL revocation, same-file retry and focus/live-region feedback.

File reading and download triggering are injected into `createBrowserApp` tests. Runtime errors use clear Swedish messages and contain no imported data.

## UI integration

Add a compact "Din data" section using existing button and inline-confirmation classes. A restore control is available from onboarding so a fresh browser can recover a backup; download controls appear only when a real profile exists. Export stays read-only and works in local, session or memory mode. All data actions are absent or blocked in synthetic demo mode. Restore confirmation is reachable and operable by keyboard and focus returns to a stable control after cancel or success.

## Definition of done

- JSON export is canonical AppState v1 and demo data cannot be exported.
- Invalid/unsupported/oversized restore attempts stop before persistence and do not mutate anything.
- Replacement requires explicit inline confirmation.
- Successful restore persists through the repository; the controller never writes a storage layer directly.
- A repository failure keeps controller state and preview, and a post-write storage conflict is tested and disclosed without claiming stored bytes are unchanged.
- CSV is deterministic, inclusive, private and header-only at codec level for empty stays.
- Object URLs are revoked and same-file retry works.
- Targeted tests, `npm run check` and the updated localhost QA pass.
