# Writing Studio

Writing Studio is the first website phase of a writing assistant that learns from documents a user chooses and suggests the next 3 to 10 words while they type.

## Phase one

- Import TXT, Markdown, DOCX, and PDF documents in the browser.
- Use local phrase matching to suggest continuations from the imported documents.
- Accept a suggestion with Tab, dismiss it with Escape, or use the visible Insert action.
- Adjust suggestion length from 3 to 10 words.
- Review local, rule-based rewrite suggestions for selected text.
- Export the draft only when the user chooses.

The app uses deterministic code only. It does not call an AI model or send document text to a service.

## Privacy

Uploaded documents and the current draft stay in browser memory. The site does not save them to browser storage, upload them to a server, or send them to analytics. Refreshing or closing the tab clears the in-memory workspace. Export creates a local download only after the user asks.

## Limits

Autocomplete reuses wording found in the imported documents. It does not generate new semantic content. Rule-based rewrites use a small synonym and phrase list, so users should review each result before inserting it.

This website does not insert text into Word, Google Docs, or other apps. System-wide insertion is planned for a later macOS app phase.

## Project status

This is the first local website phase. It has not been deployed as a hosted service. The workspace layout was checked in Chromium and Safari. DOCX import was checked in Chromium only. Other browser engines still need import review.

Until the DOCX parser has broader malformed-archive coverage, use synthetic or non-sensitive documents during this prototype phase.

## Run locally

Open a terminal in the web folder and run:

```sh
npm install
npm run dev
```

Build the frontend with:

```sh
npm run build
```

## Future direction

The next product phase may be a native macOS utility. Any model feature must use a verified free API and free model, and must not send documents without an explicit user choice.

## License

The repository is prepared for an open-source first release. The initial license is MIT. Making the repository private later will not revoke the rights already granted to public copies.

See [CONTRIBUTING.md](CONTRIBUTING.md) for local development guidance and [SECURITY.md](SECURITY.md) for reporting a security issue.
