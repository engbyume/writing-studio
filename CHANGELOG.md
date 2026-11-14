# Changelog

## 2026-11-14

- Added a fingerprint and Keychain readback check before trusting the localhost certificate for Word add-in testing.

## 2026-11-13

- Started the standalone, local-first Writing Studio project.
- Recorded the first website phase, document privacy rules, code-based autocomplete and rewrite boundary, and later macOS integration direction.
- Built the writing workspace with browser-only TXT, Markdown, DOCX, and PDF imports, source-based 3 to 10 word suggestions, rule-based rewrites, and explicit TXT export.
- Added bounded Worker parsing and documented local data handling and release limits.
- Verified a production build, zero npm audit findings, valid and oversized DOCX handling, suggestion lengths, Tab insertion, and rewrite selection in the in-app Chromium browser.
- Added contribution and security guidance plus a CycloneDX SBOM; Gitleaks found no secrets in the initial commit.
- Added a native macOS app wrapper with a loopback-only static asset server and an opt-in TextEdit Accessibility helper.
- Added the Microsoft Word task-pane add-in with local source import, selection checks, 3 to 10 word suggestions, and explicit insert and rewrite actions. Word UI verification remains pending.
- Verified the packaged Mac app imports a synthetic source and inserts a five-word continuation. The Word task pane builds, but the Word UI test is pending its local HTTPS certificate and add-in grant.
- Verified native TXT export with a synthetic draft: Save wrote the expected UTF-8 text, Cancel created no file, and the temporary export was removed.
