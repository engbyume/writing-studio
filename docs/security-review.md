# Security review

Review date: 2026-11-13
Scope: local React website, document import workers, dependencies, and repository release controls.

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
