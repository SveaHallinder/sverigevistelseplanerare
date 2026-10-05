import Foundation

enum NativeBackupError: Error {
    case oversized
    case readFailed
}

struct NativeBackup: Sendable {
    let name: String
    let size: Int
    let content: String
}

func localWebResourceURL(_ requestURL: URL, rootURL: URL) -> URL? {
    guard requestURL.scheme == "sverigeapp", requestURL.host == "local",
          requestURL.user == nil, requestURL.password == nil, requestURL.port == nil,
          requestURL.query == nil,
          let components = URLComponents(url: requestURL, resolvingAgainstBaseURL: false),
          let path = components.percentEncodedPath.removingPercentEncoding else { return nil }
    let parts = path.split(separator: "/", omittingEmptySubsequences: true)
    guard !parts.isEmpty, !parts.contains(".."), !parts.contains("."), !path.contains("\\"),
          !path.contains("\0") else { return nil }
    let relativePath = parts.joined(separator: "/")
    guard relativePath == "index.html" || relativePath == "styles.css" || relativePath.hasPrefix("src/") else { return nil }
    let allowedExtensions = ["html", "css", "js", "svg", "png"]
    let root = rootURL.standardizedFileURL.resolvingSymlinksInPath()
    let candidate = root.appendingPathComponent(relativePath).standardizedFileURL.resolvingSymlinksInPath()
    guard candidate.path.hasPrefix(root.path + "/"), allowedExtensions.contains(candidate.pathExtension) else { return nil }
    return candidate
}

func readNativeBackup(at url: URL) throws -> NativeBackup {
    let scoped = url.startAccessingSecurityScopedResource()
    defer { if scoped { url.stopAccessingSecurityScopedResource() } }
    var coordinationError: NSError?
    var result: Result<NativeBackup, any Error>?
    NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &coordinationError) { coordinatedURL in
        result = Result { try readLimitedBackup(at: coordinatedURL) }
    }
    guard coordinationError == nil, let result else { throw NativeBackupError.readFailed }
    return try result.get()
}

private func readLimitedBackup(at url: URL) throws -> NativeBackup {
    let limit = 1_048_576
    let handle: FileHandle
    do { handle = try FileHandle(forReadingFrom: url) }
    catch { throw NativeBackupError.readFailed }
    defer { try? handle.close() }
    var data = Data()
    do {
        while data.count <= limit {
            let part = try handle.read(upToCount: min(65_536, limit + 1 - data.count)) ?? Data()
            if part.isEmpty { break }
            data.append(part)
        }
    } catch { throw NativeBackupError.readFailed }
    guard data.count <= limit else { throw NativeBackupError.oversized }
    guard let content = String(data: data, encoding: .utf8) else { throw NativeBackupError.readFailed }
    return NativeBackup(name: url.lastPathComponent, size: data.count, content: content)
}

func validNativeExport(filename: String, mimeType: String) -> Bool {
    let kind: String
    let fileExtension: String
    switch mimeType {
    case "application/json;charset=utf-8": kind = "backup"; fileExtension = "json"
    case "text/csv;charset=utf-8": kind = "vistelser"; fileExtension = "csv"
    default: return false
    }
    let pattern = "^sverigevistelseplaneraren-" + kind + "-[0-9]{4}-[0-9]{2}-[0-9]{2}\\." + fileExtension + "$"
    return filename.range(of: pattern, options: .regularExpression) != nil
}
