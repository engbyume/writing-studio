import SwiftUI
import WebKit
import UniformTypeIdentifiers

struct StudioSuggestion {
    let text: String
    let source: String
}

@MainActor
final class Workspace: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate {
    @Published private(set) var errorMessage: String?
    let webView: WKWebView

    private var assets: StaticAssets?
    private var entry: URL?
    private var ready = false
    private var exportInProgress = false

    override init() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        webView.navigationDelegate = self
        webView.uiDelegate = self
        configuration.userContentController.add(DraftExportHandler(workspace: self), name: "exportDraft")
    }

    func start() {
        guard assets == nil, errorMessage == nil else { return }
        guard let root = Bundle.main.resourceURL?.appendingPathComponent("Web", isDirectory: true) else {
            errorMessage = "The app bundle is missing the Writing Studio workspace."
            return
        }
        do {
            let server = try StaticAssets(root: root)
            assets = server
            server.start { [weak self] url in
                Task { @MainActor in
                    guard let self else { return }
                    guard let url else {
                        self.ready = false
                        self.errorMessage = "The app could not start its local workspace."
                        return
                    }
                    self.entry = url
                    self.webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
                }
            }
        } catch {
            errorMessage = "The app bundle is missing the Writing Studio workspace. Run the macOS packaging script after building the website."
        }
    }

    func suggest(before: String, length: Int) async -> StudioSuggestion? {
        guard ready, webView.url == entry, before.utf16.count <= 512, (3...10).contains(length) else {
            return nil
        }

        let body = """
            if (typeof window.writingStudioSuggest !== "function") return null;
            return await window.writingStudioSuggest(before, length);
            """
        let result = try? await webView.callAsyncJavaScript(
            body, arguments: ["before": before, "length": length], in: nil, contentWorld: .page
        )
        guard ready, webView.url == entry, let result = result as? [String: String],
              let text = result["text"], let source = result["source"],
              !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              text.utf16.count <= 512, !source.isEmpty, source.utf16.count <= 512 else { return nil }
        return StudioSuggestion(text: text, source: source)
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard action.targetFrame?.isMainFrame == true, action.request.url == entry else { return .cancel }
        ready = false
        return .allow
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse) async -> WKNavigationResponsePolicy {
        guard response.isForMainFrame, response.response.url == entry else { return .cancel }
        return .allow
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        ready = webView.url == entry
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        workspaceFailed()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        workspaceFailed()
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        workspaceFailed()
    }

    func webView(
        _ webView: WKWebView,
        runOpenPanelWith parameters: WKOpenPanelParameters,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping ([URL]?) -> Void
    ) {
        let panel = NSOpenPanel()
        panel.title = "Add source documents"
        panel.prompt = "Add Sources"
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        var contentTypes: [UTType] = [.plainText, .pdf]
        if let markdown = UTType(filenameExtension: "md") { contentTypes.append(markdown) }
        if let markdown = UTType(filenameExtension: "markdown") { contentTypes.append(markdown) }
        if let docx = UTType(filenameExtension: "docx") { contentTypes.append(docx) }
        panel.allowedContentTypes = contentTypes
        panel.begin { response in
            completionHandler(response == .OK ? panel.urls : nil)
        }
    }

    fileprivate func exportDraft(_ message: WKScriptMessage) {
        guard !exportInProgress, ready, let entry, webView.url == entry,
              message.webView === webView,
              message.frameInfo.isMainFrame, message.frameInfo.request.url == entry,
              let draft = message.body as? String, let window = webView.window else { return }

        let panel = NSSavePanel()
        panel.title = "Export Draft"
        panel.prompt = "Save"
        panel.allowedContentTypes = [.plainText]
        panel.allowsOtherFileTypes = false
        panel.nameFieldStringValue = "writing-studio-draft.txt"
        exportInProgress = true
        panel.beginSheetModal(for: window) { [weak self] response in
            guard let self else { return }
            self.exportInProgress = false
            guard response == .OK, let destination = panel.url else { return }

            do {
                try draft.write(to: destination, atomically: true, encoding: .utf8)
            } catch {
                let alert = NSAlert()
                alert.alertStyle = .warning
                alert.messageText = "Could not save the draft"
                alert.informativeText = "Check the destination and try exporting again."
                alert.beginSheetModal(for: window)
            }
        }
    }

    private func workspaceFailed() {
        ready = false
        errorMessage = "The local workspace stopped loading. Reopen Writing Studio to start again."
    }
}

@MainActor
private final class DraftExportHandler: NSObject, WKScriptMessageHandler {
    private weak var workspace: Workspace?

    init(workspace: Workspace) {
        self.workspace = workspace
        super.init()
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        workspace?.exportDraft(message)
    }
}

struct WorkspaceView: NSViewRepresentable {
    let webView: WKWebView

    func makeNSView(context: Context) -> WKWebView { webView }
    func updateNSView(_ nsView: WKWebView, context: Context) {}
}
