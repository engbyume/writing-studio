# Security policy

Writing Studio is an early local website and native macOS app. It is not deployed as a hosted service. Imported files are parsed in the browser or app process, and Writing Studio does not send document text to a server.

In the macOS app, Export TXT passes the current draft from the bundled main frame to a local WebKit message handler. The app opens `NSSavePanel`, restricts the output to plain text, and writes atomically only after an explicit Save. Cancel creates no file.

DOCX handling has not been checked against a broad malformed-archive set, and DOCX import has not been verified in Safari. Use synthetic or non-sensitive files during this prototype phase.

The Word task-pane add-in requests `ReadWriteDocument`, which grants document-wide access while it is active. The code limits reads to one main-document paragraph and writes only after an explicit click, with a fresh selection check. It loads Office.js from Microsoft's official CDN. It does not send Word text to a web service. The local add-in preview requires a trusted localhost HTTPS certificate; keep certificate and key files out of Git. Do not bypass a certificate warning. Live Word verification is pending.

The native app's Accessibility mode is disabled by default. It currently supports TextEdit only, reads a bounded range before the caret, and inserts only after a click when the same selection is still active. It does not use Input Monitoring. Accessibility permission is required before it can operate.

The Mac package, source import, source-based suggestion, explicit insertion, native Save, and Save cancellation were checked with synthetic text. The Word add-in has not yet been sideloaded or tested in Word. Its local HTTPS certificate and `ReadWriteDocument` grant require explicit action-time approval before that test.

Report a suspected vulnerability through GitHub's private vulnerability reporting feature for this repository. It is enabled. Do not post private documents, credentials, or exploit details in a public issue. If the private reporting route is unavailable, contact the repository owner through GitHub before sharing details.

The security review and known limits are documented in [`docs/security-review.md`](docs/security-review.md).
