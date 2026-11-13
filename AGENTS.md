# Project Instructions

This repository starts as a standalone writing website. A native macOS app and system-wide insertion are later phases.

## Data and feature boundaries

- Read TXT, Markdown, DOCX, and PDF files in the browser only.
- Keep uploaded text and the current draft in memory for this phase. Do not store them in localStorage, sessionStorage, IndexedDB, logs, analytics, or a server.
- Limit imports to 10 files, 10 MiB per file, 50 MiB aggregate input, 1 MiB extracted text per file, and 5 MiB total extracted text. Parse DOCX/PDF in a Worker with a 15-second timeout.
- Autocomplete and rewrite suggestions must use deterministic local code only in phase one. Do not add a model API or network service.
- Show the source filename for document-based suggestions.
- Do not add external fonts, analytics, cloud storage, authentication, or remote assets.
- If a future task proposes AI, check that the API and models are free before selecting them. Do not make model calls, create provider accounts, or incur usage without current user authorization.

## Development

- Frontend: React, TypeScript, Vite, Tailwind, and shadcn with Base UI primitives.
- Keep the interface responsive and keyboard accessible.
- Use the pinned shadcn CLI version 4.22.0. Use only the official shadcn registry.
- Preserve the active product design and privacy boundary when changing features.
