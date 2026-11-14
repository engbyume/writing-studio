import AppKit
import ApplicationServices

enum EditorSelection {
    static let allowedBundleID = "com.apple.TextEdit"

    struct Editor {
        let pid: pid_t
        let element: AXUIElement
    }

    enum State {
        case idle
        case unsupportedApp
        case unsupportedEditor
        case caret(Caret)
    }

    struct Caret {
        let pid: pid_t
        let element: AXUIElement
        let selection: CFRange
        let prefix: String
        let bounds: CGRect

        func matches(_ other: Caret) -> Bool {
            pid == other.pid && CFEqual(element, other.element)
                && selection.location == other.selection.location
                && selection.length == other.selection.length && prefix == other.prefix
        }

        func insert(_ text: String) -> Bool {
            guard let focused = EditorSelection.focusedEditor(in: EditorSelection.application(pid), pid: pid),
                  CFEqual(element, focused.element),
                  EditorSelection.isSettable(element),
                  let latest = EditorSelection.selectedRange(element),
                  latest.location == selection.location, latest.length == selection.length,
                  EditorSelection.stillFrontmost(pid) else { return false }
            let insertion = prefix.last?.isWhitespace == false ? " " + text : text
            return AXUIElementSetAttributeValue(element, kAXSelectedTextAttribute as CFString, insertion as CFString) == .success
        }
    }

    static func application(_ pid: pid_t) -> AXUIElement {
        let application = AXUIElementCreateApplication(pid)
        AXUIElementSetMessagingTimeout(application, 0.15)
        return application
    }

    static func focusedEditor(in application: AXUIElement, pid: pid_t) -> Editor? {
        guard stillFrontmost(pid),
              let value = attribute(application, kAXFocusedUIElementAttribute),
              CFGetTypeID(value) == AXUIElementGetTypeID() else { return nil }
        let element = value as! AXUIElement
        var elementPID: pid_t = 0
        guard AXUIElementGetPid(element, &elementPID) == .success,
              elementPID == pid,
              attribute(element, kAXRoleAttribute) as? String == kAXTextAreaRole,
              attribute(element, kAXSubroleAttribute) as? String != kAXSecureTextFieldSubrole else { return nil }
        return Editor(pid: pid, element: element)
    }

    static func inspect() -> State {
        guard AXIsProcessTrusted(), let app = NSWorkspace.shared.frontmostApplication,
              app.processIdentifier != ProcessInfo.processInfo.processIdentifier else { return .idle }
        guard app.bundleIdentifier == allowedBundleID else { return .unsupportedApp }
        guard let editor = focusedEditor(in: application(app.processIdentifier), pid: app.processIdentifier),
              isSettable(editor.element),
              let selection = selectedRange(editor.element),
              selection.location >= 0, selection.length == 0 else { return .unsupportedEditor }
        let element = editor.element
        let elementPID = editor.pid
        guard selection.location > 0 else { return .idle }

        let prefixLength = min(selection.location, 512)
        let prefixRange = CFRange(location: selection.location - prefixLength, length: prefixLength)
        guard stillFrontmost(elementPID),
              let prefix = parameter(element, kAXStringForRangeParameterizedAttribute, range: prefixRange) as? String,
              prefix.utf16.count == prefixLength,
              stillFrontmost(elementPID),
              let bounds = caretBounds(element, range: selection),
              stillFrontmost(elementPID) else { return .unsupportedEditor }
        return .caret(Caret(pid: elementPID, element: element, selection: selection, prefix: prefix, bounds: bounds))
    }

    static func isSettable(_ element: AXUIElement) -> Bool {
        var settable: DarwinBoolean = false
        return AXUIElementIsAttributeSettable(element, kAXSelectedTextAttribute as CFString, &settable) == .success
            && settable.boolValue
    }

    static func stillFrontmost(_ pid: pid_t) -> Bool {
        guard AXIsProcessTrusted(), let active = NSWorkspace.shared.frontmostApplication else { return false }
        return active.bundleIdentifier == allowedBundleID && active.processIdentifier == pid
    }

    private static func selectedRange(_ element: AXUIElement) -> CFRange? {
        guard let value = attribute(element, kAXSelectedTextRangeAttribute),
              CFGetTypeID(value) == AXValueGetTypeID() else { return nil }
        var range = CFRange()
        return AXValueGetValue(value as! AXValue, .cfRange, &range) ? range : nil
    }

    private static func caretBounds(_ element: AXUIElement, range: CFRange) -> CGRect? {
        guard let value = parameter(element, kAXBoundsForRangeParameterizedAttribute, range: range),
              CFGetTypeID(value) == AXValueGetTypeID() else { return nil }
        var bounds = CGRect.zero
        guard AXValueGetValue(value as! AXValue, .cgRect, &bounds),
              bounds.origin.x.isFinite, bounds.origin.y.isFinite,
              bounds.width.isFinite, bounds.width >= 0,
              bounds.height.isFinite, bounds.height > 0 else { return nil }
        return bounds
    }

    private static func parameter(_ element: AXUIElement, _ name: String, range: CFRange) -> CFTypeRef? {
        var range = range
        guard let input = AXValueCreate(.cfRange, &range) else { return nil }
        var value: CFTypeRef?
        let error = AXUIElementCopyParameterizedAttributeValue(element, name as CFString, input, &value)
        return error == .success ? value : nil
    }

    private static func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
        var value: CFTypeRef?
        let error = AXUIElementCopyAttributeValue(element, name as CFString, &value)
        return error == .success ? value : nil
    }
}
