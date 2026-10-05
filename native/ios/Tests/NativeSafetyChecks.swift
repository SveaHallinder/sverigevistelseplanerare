import Foundation

private struct CheckFailure: Error {
    let description: String
}

private func expect(_ condition: Bool, _ message: String) throws {
    if !condition { throw CheckFailure(description: message) }
}

@main
struct NativeSafetyChecks {
    static func main() throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("sverige-native-check-" + UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let web = root.appendingPathComponent("Web", isDirectory: true)
        let src = web.appendingPathComponent("src", isDirectory: true)
        try FileManager.default.createDirectory(at: src, withIntermediateDirectories: true)
        try Data("ready".utf8).write(to: src.appendingPathComponent("main.js"))

        let valid = URL(string: "sverigeapp://local/src/main.js")!
        try expect(localWebResourceURL(valid, rootURL: web) != nil, "bundled module should resolve")
        for value in [
            "sverigeapp://other/src/main.js", "https://local/src/main.js",
            "sverigeapp://local/src/%2e%2e/%2e%2e/Info.plist",
            "sverigeapp://local/Info.plist", "sverigeapp://local/src/main.js?private=1"
        ] {
            try expect(localWebResourceURL(URL(string: value)!, rootURL: web) == nil, "unsafe resource accepted")
        }
        let outside = root.appendingPathComponent("outside.js")
        try Data("private".utf8).write(to: outside)
        try FileManager.default.createSymbolicLink(at: src.appendingPathComponent("alias.js"), withDestinationURL: outside)
        try expect(localWebResourceURL(URL(string: "sverigeapp://local/src/alias.js")!, rootURL: web) == nil,
                   "symlink outside bundle accepted")

        let json = "{\"name\":\"Åsa\"}"
        let backupURL = root.appendingPathComponent("backup.json")
        try Data(json.utf8).write(to: backupURL)
        let backup = try readNativeBackup(at: backupURL)
        try expect(backup.name == "backup.json" && backup.content == json && backup.size == json.utf8.count,
                   "backup byte count or UTF-8 content changed")
        try Data(repeating: 65, count: 1_048_576).write(to: backupURL)
        try expect(try readNativeBackup(at: backupURL).size == 1_048_576, "exact 1 MiB backup rejected")
        try Data(repeating: 65, count: 1_048_577).write(to: backupURL)
        do {
            _ = try readNativeBackup(at: backupURL)
            throw CheckFailure(description: "oversized backup accepted")
        } catch NativeBackupError.oversized { }
        try Data([0xff, 0xfe]).write(to: backupURL)
        do {
            _ = try readNativeBackup(at: backupURL)
            throw CheckFailure(description: "invalid UTF-8 backup accepted")
        } catch NativeBackupError.readFailed { }

        try expect(validNativeExport(filename: "sverigevistelseplaneraren-backup-2026-10-05.json",
                                     mimeType: "application/json;charset=utf-8"), "canonical JSON export rejected")
        try expect(validNativeExport(filename: "sverigevistelseplaneraren-vistelser-2026-10-05.csv",
                                     mimeType: "text/csv;charset=utf-8"), "canonical CSV export rejected")
        for filename in ["../private.json", "/tmp/private.json", "backup.json", "sverigevistelseplaneraren-backup-2026-10-05.csv"] {
            try expect(!validNativeExport(filename: filename, mimeType: "application/json;charset=utf-8"),
                       "unexpected export filename accepted")
        }
        try expect(!validNativeExport(filename: "sverigevistelseplaneraren-backup-2026-10-05.json", mimeType: "text/html"),
                   "unexpected MIME accepted")
        try expect(!validNativeExport(filename: "sverigevistelseplaneraren-backup-2026-10-05.json\n",
                                      mimeType: "application/json;charset=utf-8"), "newline in filename accepted")
        print("[sverigevistelseplanerare ios] Native resource and file safety checks passed.")
    }
}
