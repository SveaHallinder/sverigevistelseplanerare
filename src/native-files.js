import { MAX_IMPORT_BYTES } from "./data-transfer.js";

function importError(code = "read-failed") {
  const error = new Error("Backupfilen kunde inte läsas. Ingen data har ändrats.");
  error.code = code;
  return error;
}

export function createNativeFileBridge(windowRef) {
  let handler;
  try {
    handler = windowRef?.webkit?.messageHandlers?.sverigeNative;
    if (typeof handler?.postMessage !== "function") return null;
  } catch {
    return null;
  }

  return {
    async chooseBackupFile() {
      const reply = await handler.postMessage({ action: "import" });
      if (reply?.ok === false && reply.cancelled === true) return null;
      if (reply?.error === "oversized") throw importError("oversized");
      const file = reply?.file;
      if (reply?.ok !== true || typeof file?.name !== "string"
        || typeof file.content !== "string" || !Number.isInteger(file.size) || file.size < 0) {
        throw importError();
      }
      if (file.size > MAX_IMPORT_BYTES
        || new TextEncoder().encode(file.content).byteLength > MAX_IMPORT_BYTES) {
        throw importError("oversized");
      }
      return { name: file.name, size: file.size, text: async () => file.content };
    },

    async downloadFile(file) {
      const reply = await handler.postMessage({ action: "export", file });
      if (reply?.ok === false && reply.cancelled === true) return { cancelled: true };
      if (reply?.ok !== true) throw new Error("Filen kunde inte exporteras.");
      return { message: "Filen har exporterats." };
    }
  };
}
