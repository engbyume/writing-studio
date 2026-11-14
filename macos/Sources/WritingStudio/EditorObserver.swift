import AppKit
import ApplicationServices

private func editorChanged(
    _ observer: AXObserver, _ element: AXUIElement, _ notification: CFString, _ context: UnsafeMutableRawPointer?
) {
    guard let context else { return }
    MainActor.assumeIsolated {
        Unmanaged<EditorObserver>.fromOpaque(context).takeUnretainedValue().onChange()
    }
}

@MainActor
final class EditorObserver {
    let pid: pid_t
    private let observer: AXObserver
    private let application: AXUIElement
    private var focused: AXUIElement?
    let onChange: () -> Void

    private static let textEvents = [kAXValueChangedNotification, kAXSelectedTextChangedNotification]

    init?(pid: pid_t, onChange: @escaping () -> Void) {
        var observer: AXObserver?
        guard AXObserverCreate(pid, editorChanged, &observer) == .success, let observer else { return nil }
        self.pid = pid
        self.observer = observer
        self.application = EditorSelection.application(pid)
        self.onChange = onChange

        guard listen(to: kAXFocusedUIElementChangedNotification, on: application) else { return nil }
        CFRunLoopAddSource(CFRunLoopGetMain(), AXObserverGetRunLoopSource(observer), .commonModes)
    }

    func trackFocusedEditor() -> Bool {
        let current = EditorSelection.focusedEditor(in: application, pid: pid)?.element
        if let focused, let current, CFEqual(focused, current) { return true }
        untrackEditor()
        guard let current else { return false }

        var registered: [String] = []
        for event in Self.textEvents {
            guard listen(to: event, on: current) else {
                for event in registered { remove(event, from: current) }
                return false
            }
            registered.append(event)
        }
        focused = current
        return true
    }

    func stop() {
        CFRunLoopRemoveSource(CFRunLoopGetMain(), AXObserverGetRunLoopSource(observer), .commonModes)
        untrackEditor()
        remove(kAXFocusedUIElementChangedNotification, from: application)
    }

    private func untrackEditor() {
        guard let focused else { return }
        for event in Self.textEvents { remove(event, from: focused) }
        self.focused = nil
    }

    private func listen(to notification: String, on element: AXUIElement) -> Bool {
        AXObserverAddNotification(observer, element, notification as CFString, Unmanaged.passUnretained(self).toOpaque()) == .success
    }

    private func remove(_ notification: String, from element: AXUIElement) {
        AXObserverRemoveNotification(observer, element, notification as CFString)
    }
}
