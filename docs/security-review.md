# Security review

Review date: 2026-11-13
Scope: phase-one React website, document import workers, dependencies, and repository release controls. The current macOS and Word architecture is covered by the update at the end of this file.

## Assessment

- Local use: pass with limits.
- Hosted service: not reviewed because no service is deployed.
- This is an early source prototype. The repository does not claim production readiness or cross-browser DOCX support.
- A read-only review assessed all 70 core and 23 conditional security checks. It counted 19 applicable core checks, 51 architecture-specific N/A core checks, 6 applicable conditional checks, and 17 architecture-specific N/A conditional checks.
- The review recommended additional malformed-archive and browser import checks before presenting the app as ready for general use. Those checks remain open.

## Architecture and controls

- Documents and drafts remain in browser memory. The app has no account system, backend, API, database, cloud storage, or analytics.
- TXT, Markdown, DOCX, and PDF imports are parsed in the browser. DOCX and PDF work runs in a Worker with a 15-second timeout.
- Imports are limited to 10 files, 10 MiB per file, 50 MiB aggregate input, 1 MiB extracted text per file, and 5 MiB total extracted text.
- DOCX ZIP processing rejects unsupported methods, ZIP64 and multi-disk archives, encryption, unsafe paths, duplicate paths, macro markers, and inconsistent headers. It limits archives to 200 entries, 20 MiB actual decompressed content, 4 MiB for `word/document.xml`, and 256 KiB for `[Content_Types].xml` before Mammoth parses the document.
- Autocomplete and rewrite suggestions use deterministic local code. They do not call a model or transmit draft text.
- Imported content renders as text. A source search found no network, browser-storage, cookie, logging, or raw HTML APIs in `web/src` or `web/index.html`.
- The CycloneDX SBOM in [`sbom.cdx.json`](sbom.cdx.json) was generated from `web/package-lock.json` with npm. It lists 142 components.
- `SECURITY.md` provides the vulnerability reporting path. The repository owner is responsible for triage. GitHub private vulnerability reporting is enabled, and the API readback confirmed `enabled: true`.

## Verification evidence

- `npm run build` passed after the final application changes.
- `npm audit` reported zero vulnerabilities.
- Gitleaks 8.30.1 scanned both commits, covering about 235.63 KB, and found no leaks.
- The production build contains no source map files.
- In the Codex in-app Chromium browser, a synthetic DOCX imported successfully, a compressed DOCX expanding beyond 20 MiB was rejected, 3-word and 10-word continuations appeared, Tab inserted the full suggestion, and a rule-based rewrite preserved initial capitalization.
- Safari loaded the workspace layout. DOCX import was not tested in Safari because its file chooser opened with recent user files; the chooser was closed without selecting a file.

## Applicable core checks

| Checks | Evidence and remaining limits |
| --- | --- |
| #8, #53, #54 | Lockfile versions and integrity hashes; build and audit pass. Package provenance was not independently checked. |
| #9, #10, #32, #37, #69 | File type, size, Worker, ZIP, and extraction limits. Valid and oversized DOCX behavior was checked in Chromium. Malformed ZIP variants and parser timeout behavior remain untested. |
| #11, #14, #27, #28, #30, #35 | In-memory document handling, text rendering, no persistence/network/logging APIs in the source. Browser Storage and Network panels were not checked at runtime. |
| #31 | Client-only processing; there is no server authorization boundary. |
| #66 | Read-only source review completed. |
| #19, #29, #52 | Gitleaks found no leaks in both commits, and the build has no source maps. Re-scan after future commits and releases. |

The other core checks were N/A for this architecture: #1, #2, #20, #21, #25, #40, #41, #42, #46, #70; #3, #4, #5, #15, #16, #17, #22, #23, #33, #34, #36, #39, #43, #47, #48, #49, #50, #57, #65, #67; #6, #7; #12, #13, #55, #56; #18, #24, #26, #45, #62; #38; #44; #51, #58, #59, #60, #61, #63, #64; and #68. These checks concern accounts, authentication, server routes, databases, external services, AI, CI/CD, hosted infrastructure, production telemetry, or filesystem execution paths that this prototype does not have.

## Applicable conditional checks

| Checks | Evidence and remaining limits |
| --- | --- |
| #71 | SBOM generated from the lockfile. |
| #72 | No binary or hosted build artifact is distributed. No provenance attestation has been created. The source commit will provide a version identifier, not a signed build attestation. |
| #83, #84 | `SECURITY.md` names the repository owner as response owner and directs reports to GitHub private vulnerability reporting. The setting is enabled and verified. No binary or hosted build artifact is distributed, so no build provenance attestation exists. |
| #82 | Documents are sensitive user data. They stay in memory and export requires user action. Browser Storage and Network panels were not checked at runtime. |
| #89 | DOCX/PDF parsers process untrusted files. Worker, size, timeout, ZIP validation, and lockfile controls apply. Malformed-archive coverage and Safari DOCX import remain open. |

The other conditional checks were N/A: #73, #74, #75; #76, #77, #78; #79; #80, #81; #85; #86; #87, #88; #90; #91; #92; and #93. They concern APIs, native app behavior, games, models, persistent data, cloud workloads, production administrators, proxies, containers, queues, or a deployed origin.

## Before a hosted or production release

- Check DOCX import in each browser that the project claims to support.
- Add focused malformed-archive checks for encrypted entries, CRC mismatch, unsafe paths, macro markers, inconsistent headers, and timeout behavior.
- Inspect browser Storage and Network panels to confirm the source-level privacy claims at runtime.
- Run a general secrets scan over the committed history and release files.
- Keep GitHub private vulnerability reporting enabled. Add provenance if packaged artifacts are introduced.
- Review CSP and other response headers when a hosting target exists.

## Current macOS and Word integration update

This addendum describes the current source tree after adding the native macOS app and Word task-pane add-in. It supersedes the website-only counts above for the current tree while preserving that earlier phase review.

### Current assessment and controls

- The macOS app packages the local web workspace in a nonpersistent WKWebView. Its static asset server binds to `127.0.0.1`, uses a fixed route map, accepts GET only, rejects unexpected host and origin values, and exposes no document-text endpoint.
- The native file picker allowlists TXT, Markdown, DOCX, and PDF. It passes selected files to the in-memory web workspace and does not persist them.
- Native Export TXT passes the current draft from the bundled main frame through a local WebKit message handler. `NSSavePanel` restricts output to plain text, and the app writes UTF-8 atomically only after Save. Cancel creates no file.
- Native Accessibility suggestions are disabled by default. This build supports TextEdit only. It checks the app's Accessibility trust state, reads at most 512 UTF-16 units before the caret, rechecks the active app, text element, and selection before insertion, and does not use Input Monitoring. The permission has not been granted or tested.
- The Word task pane loads the Office.js runtime from Microsoft's official `officeapis.public.onecdn.static.microsoft` CDN. The XML manifest requests `ReadWriteDocument`, which grants document-wide access while the add-in is active. Code limits reads to a single main-document paragraph, rejects paragraphs over 65,536 character positions, checks offset mapping, and rechecks the selection before an explicit Insert or Replace action.
- Office.js is mutable remote code. Its exact deployed version is managed by Microsoft's CDN, and the Word Add-in requires that platform runtime. The task-pane CSP allows Microsoft Office host origins in `frame-ancestors`. Writing Studio does not send document text to a web service.
- Word range APIs and native Accessibility APIs operate across host boundaries. Word read and write use separate Office.js sync calls, so the operation cannot be atomic. The app's AX insertion depends on the target application supporting a settable selected-text attribute.
- The npm CycloneDX SBOM covers the 142 packages in `web/package-lock.json`. It does not include the Office.js CDN runtime or Apple's system frameworks.

### Verification evidence and limits

- Parent verification passed: web build, Word Add-in TypeScript build, Word Add-in Vite build, `npm audit` with zero findings, Swift build, app packaging, plist validation, and app/resource byte comparison.
- Parent verification checked the native app UI, imported `synthetic-migration-source.txt`, produced the source-based five-word completion, and inserted it into the local draft. It returned the expected 10-word count.
- Parent verification saved a synthetic four-word draft through the native Save panel and read back the exact UTF-8 content. Cancel created no file. The temporary test export was removed.
- The loopback static server returned the bundled site and rejected POST, traversal, foreign Origin, and foreign Host requests. It serves no document-text endpoint.
- Word Add-in logic passed a local mock for insert, replace, stale selection, changed selection, other Word stories, cross-paragraph selections, and mismatched offset-to-text mapping. It passed XML parsing and static manifest checks.
- CUA verified that the packaged Mac app loads the workspace, imports the synthetic migration source, shows a source-backed five-word continuation, and inserts it into the draft. TextEdit Accessibility behavior remains unverified because permission was not granted.
- The Word Add-in has not been sideloaded or exercised in Word. Certificate trust and Word `ReadWriteDocument` access remain action-time gates. Word caret-event delivery, Office.js initialization under the CSP, and live selection mapping remain unverified.
- Keep a full-history Gitleaks scan and remote readback in the public update process.

### Current core check coverage

The current architecture has 26 applicable and 44 N/A core checks.

| Checks | Current evidence and limit |
| --- | --- |
| #4, #9, #10, #21, #32, #37, #38, #50, #69 | Word selection races and permission, input validation, bounded file parsing, ZIP path checks, and host writes. Worker timeout is 15 seconds. Word host calls have no app timeout. Word insertion remains unverified. |
| #8, #53, #54 | Lockfile integrity, build and audit checks pass. Office.js is a mutable Microsoft CDN runtime outside npm lockfile/SBOM. |
| #11, #14, #27, #28, #30, #35 | Sources and drafts stay in memory until the user exports; browser storage, logging, and analytics are not used. User text renders as text. Browser Storage/Network inspection remains unverified. |
| #16, #45, #62 | There is no public app endpoint. The native static server is loopback-only; the Word add-in preview uses HTTPS and a restrictive CSP with an Office host allowlist. Word embedding remains unverified. |
| #19, #29, #52, #66 | Run Gitleaks against each current Git history and release tree before public updates, and review the final diff. Earlier Gitleaks and source-map results cover prior website commits only. |
| #31 | The Word host and browser client are untrusted inputs; important decisions stay in code and do not rely on hidden UI state. |

The other 44 core checks are N/A for this architecture: #1, #2, #20, #25, #40, #41, #42, #46, #70; #3, #5, #15, #17, #22, #23, #33, #34, #36, #39, #43, #47, #48, #49, #57, #65, #67; #6, #7, #18, #24, #26; #12, #13, #55, #56; #44; #51, #58, #59, #60, #61, #63, #64; and #68. These checks concern accounts, shared business services, cloud hosting, OAuth, payments, databases, logs, or production operations not present in this local-first prototype.

### Current conditional check coverage

The current architecture has 11 applicable and 12 N/A conditional checks.

| Checks | Current evidence and limit |
| --- | --- |
| #71, #72 | The npm SBOM covers `web/package-lock.json` only. It excludes the mutable Office.js CDN runtime and Apple system frameworks. No signed or packaged app artifact is published, and no build provenance attestation exists. |
| #74, #75 | Office.js is external platform code; the add-in makes no application data API calls. The user document stays in Word. |
| #76, #77, #78 | The native app uses a nonpersistent WebKit store, no custom app links, and an opt-in Accessibility mode. Accessibility remains off and TextEdit-only. |
| #82 | Documents are sensitive. They stay in memory until the user exports. The Mac Save panel writes UTF-8 plain text only after Save, and Cancel creates no file. Browser downloads are user-triggered. The Word add-in holds imported sources in task-pane memory. Runtime storage/network inspection remains open. |
| #83, #84 | GitHub private vulnerability reporting is enabled. The repository owner handles reports. No production incident drill has run for this prototype. |
| #89 | DOCX/PDF parsing processes untrusted input in a bounded Worker. The native AX helper uses memory-safe Swift and checks Word/editor state before insert. Malformed archive cases and live Word/AX behavior remain untested. |

The other 12 conditional checks are N/A: #73 no product API; #79 no game; #80 and #81 no model or RAG; #85 no critical persistent data; #86 no cloud workload; #87 and #88 no authenticated administrator or user account; #90 no proxy; #91 no container; #92 no queue; and #93 no hosted origin.

### Before public promotion or hosted release

- Run Gitleaks against current Git history and the final release tree, then verify remote readback.
- Complete the action-time Word add-in sideload and certificate trust, then test the Word UI using only synthetic content.
- Keep the Office.js CDN runtime and its document-wide host permission documented. The Office.js runtime is not included in the npm SBOM.
- Grant Accessibility only if the user chooses to test TextEdit support. Do not enable Input Monitoring.
- Test malformed DOCX variants and browser Storage/Network behavior before recommending sensitive documents.
- Add signing, notarization, and provenance if a distributable app binary is released. Review HTTP response headers if a hosted service is added.
