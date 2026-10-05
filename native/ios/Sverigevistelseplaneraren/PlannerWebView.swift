import Foundation
import SwiftUI
import UniformTypeIdentifiers
import WebKit

@MainActor
final class NativeWebState: ObservableObject {
    @Published var loadError: String?
    weak var webView: WKWebView?

    func refreshDate() {
        webView?.evaluateJavaScript("window.dispatchEvent(new Event('focus'))", completionHandler: nil)
    }

    func reload() {
        loadError = nil
        webView?.load(URLRequest(url: URL(string: "sverigeapp://local/index.html")!))
    }
}

struct PlannerWebView: UIViewRepresentable {
    let state: NativeWebState

    func makeCoordinator() -> NativeCoordinator { NativeCoordinator(state: state) }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: "sverigeapp")
        configuration.userContentController.addScriptMessageHandler(
            context.coordinator, contentWorld: .page, name: "sverigeNative"
        )
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = context.coordinator
        view.uiDelegate = context.coordinator
        view.isOpaque = false
        view.backgroundColor = .systemBackground
        context.coordinator.webView = view
        state.webView = view
        view.load(URLRequest(url: URL(string: "sverigeapp://local/index.html")!))
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) { }

    static func dismantleUIView(_ uiView: WKWebView, coordinator: NativeCoordinator) {
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "sverigeNative", contentWorld: .page)
        coordinator.cancelPendingRequest()
    }
}

private final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
        guard let url = task.request.url,
              let root = Bundle.main.resourceURL?.appendingPathComponent("Web", isDirectory: true),
              let file = localWebResourceURL(url, rootURL: root) else {
            task.didFailWithError(URLError(.resourceUnavailable))
            return
        }
        do {
            let data = try Data(contentsOf: file)
            let types = ["html": "text/html", "css": "text/css", "js": "text/javascript",
                         "svg": "image/svg+xml", "png": "image/png"]
            let response = URLResponse(url: url, mimeType: types[file.pathExtension],
                                       expectedContentLength: data.count, textEncodingName: "utf-8")
            task.didReceive(response)
            task.didReceive(data)
            task.didFinish()
        } catch {
            task.didFailWithError(URLError(.resourceUnavailable))
        }
    }

    func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) { }
}

@MainActor
final class NativeCoordinator: NSObject, WKScriptMessageHandlerWithReply, WKNavigationDelegate, WKUIDelegate, UIDocumentPickerDelegate {
    weak var webView: WKWebView?
    private let state: NativeWebState
    private var pendingID: UUID?
    private var pendingAction: String?
    private var pendingReply: (@MainActor @Sendable (Any?, String?) -> Void)?
    private var pendingPicker: UIDocumentPickerViewController?
    private var temporaryExport: URL?

    init(state: NativeWebState) {
        self.state = state
        super.init()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame,
              let source = message.frameInfo.request.url,
              source.scheme == "sverigeapp", source.host == "local", source.path == "/index.html",
              source.user == nil, source.password == nil, source.port == nil,
              webView?.url?.scheme == "sverigeapp", webView?.url?.host == "local",
              webView?.url?.path == "/index.html",
              let payload = message.body as? [String: Any],
              let action = payload["action"] as? String else {
            replyHandler(["ok": false, "error": "read-failed"], nil)
            return
        }
        let error = action == "export" ? "export-failed" : "read-failed"
        guard pendingID == nil, let presenter = webView?.owningViewController,
              presenter.presentedViewController == nil else {
            replyHandler(["ok": false, "error": error], nil)
            return
        }
        let id = UUID()
        let picker: UIDocumentPickerViewController
        if action == "import" {
            picker = UIDocumentPickerViewController(forOpeningContentTypes: [.json], asCopy: false)
            picker.allowsMultipleSelection = false
        } else if action == "export" {
            guard let file = payload["file"] as? [String: Any],
                  let filename = file["filename"] as? String,
                  let mimeType = file["mimeType"] as? String,
                  let content = file["content"] as? String,
                  validNativeExport(filename: filename, mimeType: mimeType) else {
                replyHandler(["ok": false, "error": "export-failed"], nil)
                return
            }
            let directory = FileManager.default.temporaryDirectory
                .appendingPathComponent("sverige-export-" + id.uuidString, isDirectory: true)
            do {
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                let url = directory.appendingPathComponent(filename)
                try Data(content.utf8).write(to: url, options: .atomic)
                temporaryExport = directory
                picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
            } catch {
                try? FileManager.default.removeItem(at: directory)
                replyHandler(["ok": false, "error": "export-failed"], nil)
                return
            }
        } else {
            replyHandler(["ok": false, "error": "read-failed"], nil)
            return
        }
        pendingID = id
        pendingAction = action
        pendingReply = replyHandler
        pendingPicker = picker
        picker.delegate = self
        picker.modalPresentationStyle = .formSheet
        presenter.present(picker, animated: true)
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard controller === pendingPicker, let id = pendingID else { return }
        guard let url = urls.first else {
            finish(["ok": false, "cancelled": true], id: id)
            return
        }
        if pendingAction == "export" {
            finish(["ok": true], id: id)
            return
        }
        Task { @MainActor in
            do {
                let backup = try await Task.detached { try readNativeBackup(at: url) }.value
                finish(["ok": true, "file": ["name": backup.name, "size": backup.size, "content": backup.content]], id: id)
            } catch NativeBackupError.oversized {
                finish(["ok": false, "error": "oversized"], id: id)
            } catch {
                finish(["ok": false, "error": "read-failed"], id: id)
            }
        }
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        guard controller === pendingPicker, let id = pendingID else { return }
        finish(["ok": false, "cancelled": true], id: id)
    }

    func cancelPendingRequest() {
        guard let id = pendingID else { return }
        pendingPicker?.dismiss(animated: false)
        finish(["ok": false, "cancelled": true], id: id)
    }

    private func finish(_ result: [String: Any], id: UUID) {
        guard pendingID == id else { return }
        let reply = pendingReply
        pendingReply = nil
        pendingID = nil
        pendingAction = nil
        pendingPicker = nil
        if let directory = temporaryExport {
            try? FileManager.default.removeItem(at: directory)
            temporaryExport = nil
        }
        reply?(result, nil)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if url.scheme == "sverigeapp", url.host == "local" {
            decisionHandler(.allow)
            return
        }
        openOfficialSource(url)
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url { openOfficialSource(url) }
        return nil
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        state.loadError = nil
        state.refreshDate()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error) {
        showLoadError(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) {
        showLoadError(error)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        cancelPendingRequest()
        state.loadError = "Webbvyn stängdes. Försök ladda planen igen."
    }

    private func showLoadError(_ error: any Error) {
        guard (error as NSError).code != NSURLErrorCancelled else { return }
        state.loadError = "Appens lokala filer kunde inte visas. Försök igen."
    }

    private func openOfficialSource(_ url: URL) {
        let hosts = ["www.skatteverket.se", "www4.skatteverket.se", "www.riksdagen.se"]
        guard url.scheme == "https", let host = url.host, hosts.contains(host),
              url.user == nil, url.password == nil, url.port == nil else { return }
        UIApplication.shared.open(url)
    }
}

private extension UIView {
    var owningViewController: UIViewController? {
        var responder: UIResponder? = self
        while let current = responder {
            if let controller = current as? UIViewController { return controller }
            responder = current.next
        }
        return nil
    }
}
