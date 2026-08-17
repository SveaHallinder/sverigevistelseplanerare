import { daysInclusive } from "./domain/dates.js";
import { decodeStoredState, serializeAppState } from "./storage.js";

export const MAX_IMPORT_BYTES = 1_048_576;

function failed(message) {
  return { ok: false, message };
}

function csvCell(value) {
  const text = String(value);
  return /[",\r\n]/.test(text)
    ? '"' + text.replaceAll('"', '""') + '"'
    : text;
}

export function createBackupJson(state) {
  try {
    return { ok: true, value: serializeAppState(state) };
  } catch {
    return failed("Backupen kunde inte skapas från den aktuella datan.");
  }
}

export function parseBackupJson(raw) {
  if (typeof raw !== "string") {
    return failed("Backupfilen innehåller inte giltig JSON.");
  }
  const decoded = decodeStoredState(raw.replace(/^\uFEFF/, ""));
  if (decoded.ok && decoded.state !== null) {
    return { ok: true, value: decoded.state };
  }
  const messages = {
    "unsupported-version": "Backupfilens version stöds inte.",
    "invalid-state": "Backupfilen har en ogiltig struktur.",
    "invalid-json": "Backupfilen innehåller inte giltig JSON."
  };
  return failed(
    messages[decoded.issue?.code]
      ?? "Backupfilen kunde inte läsas."
  );
}

export function createStayCsv(state) {
  let canonical;
  try {
    canonical = JSON.parse(serializeAppState(state));
  } catch {
    return failed("Vistelserna kunde inte exporteras från den aktuella datan.");
  }

  const statusOrder = { actual: 0, planned: 1 };
  const stays = [...canonical.stays].sort((left, right) =>
    left.arrivalDate.localeCompare(right.arrivalDate)
    || left.departureDate.localeCompare(right.departureDate)
    || statusOrder[left.status] - statusOrder[right.status]);
  const rows = stays.map((stay) => [
    stay.arrivalDate,
    stay.departureDate,
    stay.status === "actual" ? "faktisk" : "planerad",
    daysInclusive(stay.arrivalDate, stay.departureDate)
  ].map(csvCell).join(","));

  return {
    ok: true,
    value: [
      "ankomstdatum,avresedatum,status,kalenderdagar",
      ...rows
    ].join("\r\n") + "\r\n"
  };
}
