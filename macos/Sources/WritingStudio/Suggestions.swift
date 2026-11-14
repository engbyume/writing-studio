import AppKit
import SwiftUI

@MainActor
final class Suggestions: ObservableObject {
    @Published private(set) var isEnabled = false
    @Published private(set) var status = "Off"
    @Published var allowsTextEdit = false {
        didSet {
            if !allowsTextEdit { stop() }
        }
    }

    private let workspace: Workspace
    private var watchdog: Timer?
    private var editorObserver: EditorObserver?
    private var refreshTask: Task<Void, Never>?
    private var activation: (any NSObjectProtocol)?
    private var panel: NSPanel?
    private var caret: EditorSelection.Caret?
    private var pending: Task<Void, Never>?
    private var suggestion: StudioSuggestion?

    init(workspace: Workspace) {
        self.workspace = workspace
    }

    func start() {
        guard !isEnabled, allowsTextEdit else { return }
        guard AXIsProcessTrusted() else {
            status = "Accessibility access is required. Grant access in System Settings, then turn suggestions on here."
            return
        }

        isEnabled = true
        activation = NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.activeApplicationChanged() }
        }
        let watchdog = Timer(timeInterval: 1, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.checkObserver() }
        }
        RunLoop.main.add(watchdog, forMode: .common)
        self.watchdog = watchdog
        activeApplicationChanged()
    }

    func stop() {
        watchdog?.invalidate()
        watchdog = nil
        if let activation { NSWorkspace.shared.notificationCenter.removeObserver(activation) }
        activation = nil
        unobserve()
        isEnabled = false
        status = "Off"
    }

    private func checkObserver() {
        guard AXIsProcessTrusted() else {
            stop()
            status = "Accessibility access was removed. Suggestions are off."
            return
        }
        if let editorObserver, !EditorSelection.stillFrontmost(editorObserver.pid) {
            activeApplicationChanged()
        }
    }

    private func activeApplicationChanged() {
        unobserve()
        guard isEnabled, allowsTextEdit, AXIsProcessTrusted() else { return }
        guard let app = NSWorkspace.shared.frontmostApplication else { return }
        guard app.bundleIdentifier == EditorSelection.allowedBundleID else {
            status = "On. Accessibility suggestions currently support TextEdit."
            return
        }
        editorObserver = EditorObserver(pid: app.processIdentifier) { [weak self] in self?.scheduleRefresh() }
        guard editorObserver != nil else {
            status = "On. TextEdit did not expose the required Accessibility notifications."
            return
        }
        scheduleRefresh()
    }

    private func unobserve() {
        refreshTask?.cancel()
        refreshTask = nil
        editorObserver?.stop()
        editorObserver = nil
        clear()
    }

    private func scheduleRefresh() {
        // Remove the previous proposal immediately and inspect only after editing settles.
        clear()
        refreshTask?.cancel()
        refreshTask = Task { [weak self] in
            do { try await Task.sleep(for: .milliseconds(200)) } catch { return }
            self?.refresh()
        }
    }

    private func refresh() {
        guard isEnabled else { return }
        guard AXIsProcessTrusted() else {
            stop()
            status = "Accessibility access was removed. Suggestions are off."
            return
        }
        guard allowsTextEdit, let editorObserver,
              EditorSelection.stillFrontmost(editorObserver.pid) else { return }
        guard editorObserver.trackFocusedEditor() else {
            status = "On. Place the caret in a TextEdit document that exposes Accessibility text controls."
            return
        }

        switch EditorSelection.inspect() {
        case .idle:
            clear()
            status = "On. Place the caret in an editable TextEdit document."
        case .unsupportedApp:
            clear()
            status = "On. Accessibility suggestions currently support TextEdit."
        case .unsupportedEditor:
            clear()
            status = "On. This editor or selection does not expose the required Accessibility text controls."
        case let .caret(current):
            update(for: current)
        }
    }

    private func update(for current: EditorSelection.Caret) {
        caret = current
        status = "On. Checking for a continuation."
        pending = Task { [weak self, workspace] in
            let reply = await workspace.suggest(before: current.prefix, length: 5)
            guard !Task.isCancelled, let self, isEnabled,
                  case let .caret(latest) = EditorSelection.inspect(),
                  latest.matches(current) else { return }
            guard let reply else {
                caret = nil
                status = "On. No continuation available. Import a source in Writing Studio for more matches."
                return
            }
            status = "On. Continuation available in TextEdit."
            suggestion = reply
            showPanel(at: latest.bounds, suggestion: reply)
        }
    }

    private func accept() {
        let proposed = suggestion
        let original = caret
        clear()
        guard isEnabled, allowsTextEdit, let proposed, let original,
              case let .caret(current) = EditorSelection.inspect(), current.matches(original),
              current.insert(proposed.text) else {
            status = "On. The insertion was cancelled. Try again from the current caret."
            return
        }
        status = "On. Inserted the continuation in TextEdit."
    }

    private func clear() {
        pending?.cancel()
        pending = nil
        caret = nil
        suggestion = nil
        panel?.orderOut(nil)
        panel?.contentView = nil
        panel = nil
    }

    private func showPanel(at bounds: CGRect, suggestion: StudioSuggestion) {
        let panel = NSPanel(
            contentRect: CGRect(x: 0, y: 0, width: 300, height: 146),
            styleMask: [.titled, .nonactivatingPanel], backing: .buffered, defer: false
        )
        panel.title = "Writing Studio"
        panel.level = .floating
        panel.hidesOnDeactivate = false
        panel.isFloatingPanel = true
        panel.becomesKeyOnlyIfNeeded = true
        panel.isReleasedWhenClosed = false
        panel.contentView = NSHostingView(rootView: SuggestionCard(
            suggestion: suggestion,
            onInsert: { [weak self] in self?.accept() },
            onPause: { [weak self] in self?.stop() }
        ))
        self.panel = panel
        positionPanel(under: bounds)
    }

    private func positionPanel(under bounds: CGRect) {
        guard let panel, let yOrigin = NSScreen.screens.first?.frame.maxY else { return }
        let anchor = CGPoint(x: bounds.minX, y: yOrigin - bounds.maxY)
        guard let screen = NSScreen.screens.first(where: { $0.frame.contains(anchor) }) else {
            panel.orderOut(nil)
            return
        }
        let visible = screen.visibleFrame.insetBy(dx: 8, dy: 8)
        let x = min(max(anchor.x, visible.minX), visible.maxX - panel.frame.width)
        let below = anchor.y - panel.frame.height - 6
        let above = anchor.y + bounds.height + 6
        let y = min(max(below >= visible.minY ? below : above, visible.minY), visible.maxY - panel.frame.height)
        panel.setFrameOrigin(CGPoint(x: x, y: y))
        if !panel.isVisible { panel.orderFrontRegardless() }
    }
}

private struct SuggestionCard: View {
    let suggestion: StudioSuggestion
    let onInsert: () -> Void
    let onPause: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ScrollView {
                Text(suggestion.text)
                    .font(.system(.body, design: .serif))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            Text("Source: " + suggestion.source)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .help(suggestion.source)
            HStack {
                Button("Insert", action: onInsert)
                    .buttonStyle(.borderedProminent)
                Spacer()
                Button("Pause", action: onPause)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}
