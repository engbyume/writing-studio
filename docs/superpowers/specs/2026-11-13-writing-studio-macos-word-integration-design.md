# Writing Studio for Mac and Word

Date: 2026-11-13

## Goal

Extend the local-first Writing Studio website into a macOS app and a Word integration that offers source-based 3 to 10 word continuations while the user writes. Keep autocomplete and rewrites deterministic. Keep source documents and drafts in memory, and do not send their text to an external service.

## Product research

- Grammarly for Mac uses a floating widget and a side tab across supported apps. Its support guidance says macOS text must be exposed through accessibility.
- Grammarly discontinued its separate Word add-in for Mac. The current Grammarly desktop experience is distinct from an Office task pane.
- Microsoft supports Word task pane add-ins on Mac. The add-in uses a web task pane, a manifest, and Office.js to read and edit the active Word document.
- The installed Word version is 16.115. Microsoft lists WordApiDesktop 1.4, including range start and end offsets, for Word on Mac from 16.100.4.

## Chosen design

### macOS app

- Build a native SwiftUI app that hosts the current local Writing Studio workspace in a WKWebView.
- Bundle the built web assets with the app. The app does not require a cloud host or account.
- Add an optional Accessibility suggestion mode behind a permission check. Keep it off by default. This build supports TextEdit only; add other apps after verifying their accessibility text and insertion behavior. Do not monitor global keystrokes or use Input Monitoring.
- When enabled, inspect only the frontmost TextEdit text field. Keep Word on its task-pane integration to avoid duplicate suggestions. Read only bounded context around the caret. Show a visible active state and let the user pause the feature.
- Insert only when the same accessible text element and selection range remain active and the target supports setting selected text. Fail closed for unsupported editors.

### Word add-in

- Add a Word task pane extension with an add-in-only XML manifest for wider Word compatibility.
- Load Office.js from Microsoft's official CDN. Use Office.js only to read the active Word selection and insert accepted text; do not transmit document text to a server.
- Use the document-level `DocumentSelectionChanged` event. Check for WordApiDesktop 1.4 before using range offsets. The task pane reads only the paragraph containing the current selection and computes the prefix before the caret.
- Reuse the existing TypeScript phrase-matching, rule-based rewrite, and document parsing code. The add-in keeps its own sources in memory for the current Word session. It does not bridge or synchronize source text with the Mac app.
- Do not change the Word document until the user selects an explicit Insert or Use this wording action. Before insertion, verify that the Word selection still matches the one used to create the suggestion.
- If Word does not fire selection events on caret-only movement, provide a visible Refresh action and report the limitation. Do not add background polling.

### Visual and interaction direction

- Keep the existing Writing Studio identity and editorial palette.
- In Word, use a compact task pane with the source list, next-words suggestion, rewrite choices, and visible insert action. Match Word's task-pane width and keep keyboard focus and host document control predictable.
- In the Mac app, use native macOS navigation, menu bar, focus, and keyboard behavior. Do not copy Grammarly's branding or screen layout.

## Permissions and local development

- The Mac app's Accessibility mode needs explicit permission in macOS Privacy & Security. The app explains its scope and remains disabled until the user turns it on.
- The Word manifest requests `ReadWriteDocument`, which is needed to inspect the selection and insert approved text. Install the sideloaded manifest only for a user-requested Word test.
- Office add-in development uses HTTPS on localhost and a trusted local development certificate. Do not alter certificate trust without action-time confirmation. Stop and remove the temporary Word sideload after testing unless the user asks to keep it.

## Scope limits

- No AI/model API, account, cloud storage, telemetry, network bridge, or paid service.
- No automatic saving of documents or drafts.
- The native app and Word task pane hold separate in-memory source libraries. The user imports documents in each context.
- No production deployment, Marketplace submission, or code signing/notarization in this phase.

## Evaluation

- The macOS app builds and opens the local-first Writing Studio workspace.
- The Word add-in loads in Word for Mac 16.115.
- With a synthetic source document in memory and synthetic text in an unsaved Word document, the add-in shows a source-backed continuation, updates at a typing/caret change or visible Refresh action, and inserts it at the intended selection only after user action.
- A selected synthetic passage produces the existing local rewrite choices. The user can accept a rewrite or keep the original.
- Source and draft text remain in app memory. No app endpoint receives Word document content.
- The Accessibility mode is off unless the user grants the OS permission; no keystroke monitoring occurs.
- Build checks, dependency audit, static security review, and Word UI checks pass. Any unsupported Word event or insertion capability is documented.

## Sources

- [Grammarly for Mac and Windows guide](https://support.grammarly.com/hc/en-us/articles/4412816078349-Grammarly-for-Windows-and-Grammarly-for-Mac-user-guide)
- [Grammarly for Word on Mac discontinued](https://support.grammarly.com/hc/en-us/articles/39667635821325-Grammarly-for-Microsoft-Word-on-Mac-was-discontinued)
- [Grammarly integration guidance](https://support.grammarly.com/hc/en-us/articles/10139846131213-How-do-I-integrate-Grammarly-with-my-website-or-application)
- [Microsoft Word add-ins overview](https://learn.microsoft.com/en-us/office/dev/add-ins/word/word-add-ins-programming-overview)
- [Microsoft Word API requirement sets](https://learn.microsoft.com/en-us/office/dev/add-ins/reference/requirement-sets/word-api-requirement-sets)
- [Microsoft Mac sideloading guide](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-an-office-add-in-on-mac)
- [Apple AXIsProcessTrusted](https://developer.apple.com/documentation/applicationservices/1460720-axisprocesstrusted)
- [Apple AXUIElementSetAttributeValue](https://developer.apple.com/documentation/applicationservices/1460434-axuielementsetattributevalue)
