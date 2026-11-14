# Project Instructions

This repository contains the local-first website, a native macOS app, and a Microsoft Word task-pane add-in. A system-wide Accessibility mode is optional and remains off until the user enables it.

## Data and feature boundaries

- Read TXT, Markdown, DOCX, and PDF files in the browser or app process only.
- Keep uploaded text and the current draft in memory. Do not store them in localStorage, sessionStorage, IndexedDB, app preferences, logs, analytics, or a server.
- Limit imports to 10 files, 10 MiB per file, 50 MiB aggregate input, 1 MiB extracted text per file, and 5 MiB total extracted text. Parse DOCX/PDF in a Worker with a 15-second timeout.
- Autocomplete and rewrite suggestions must use deterministic local code only. Do not add a model API or remote network service. The Word add-in's development server may bind to loopback only.
- Show the source filename for document-based suggestions.
- Do not add external fonts, analytics, cloud storage, authentication, or remote assets.
- The Word add-in may load only Microsoft's official Office.js runtime from `https://officeapis.public.onecdn.static.microsoft/1/office.js`. Word document text stays in the Word host and in add-in memory. Do not send it to a web service.
- Request only Word's `ReadWriteDocument` add-in permission. Do not retain Word text or document identifiers. Verify the selection is unchanged before inserting.
- The native system-wide helper must remain off until the user enables it. It may inspect only the frontmost app, only when enabled, and only through the accessibility text and selection APIs. Do not install input-monitoring hooks or capture global keystrokes.
- Keep Accessibility permission gated behind a clear user action. Do not trigger the macOS permission prompt during app launch.
- If a future task proposes AI, check that the API and models are free before selecting them. Do not make model calls, create provider accounts, or incur usage without current user authorization.

## Development

- Website and Word add-in: React, TypeScript, Vite, Tailwind, and shadcn with Base UI primitives.
- Native app: SwiftUI and AppKit on macOS. Preserve the same local-only data boundary.
- Keep the interface responsive and keyboard accessible.
- Use the pinned shadcn CLI version 4.22.0. Use only the official shadcn registry.
- Preserve the active product design and privacy boundary when changing features.
- Build and test the Word add-in with the XML manifest on the installed Word for Mac. Use only synthetic documents during manual integration checks.
- The local Word add-in requires HTTPS. Do not trust a new development certificate or install its manifest into Word without a direct user confirmation at that action step.
- Immediately before trusting a local Word certificate, read its SHA-256 fingerprint and subject alternative names from the exact certificate file the preview server will use. Compare that fingerprint with the current user approval, and verify that the certificate and private key have matching public keys. Trust only SSL for `localhost` in the user's login keychain. Read back the trusted fingerprint and verify SSL hostname validation before sideloading. Stop and remove any trust entry whose fingerprint does not match the approved certificate.
