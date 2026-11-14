# Writing Studio

Writing Studio is a local writing workspace with a website, a native macOS app, and an early Microsoft Word task-pane add-in. It suggests the next 3 to 10 words from documents the user chooses and offers simple, rule-based rewrites.

## Web workspace

- Import TXT, Markdown, DOCX, and PDF documents in the browser.
- Use local phrase matching to suggest continuations from the imported documents.
- Accept a suggestion with Tab, dismiss it with Escape, or use the visible Insert action.
- Adjust suggestion length from 3 to 10 words.
- Review local, rule-based rewrite suggestions for selected text.
- Export the draft only when the user chooses.

Autocomplete and rewrites use deterministic code only. The app does not call an AI model or send document text to a service.

## Privacy

Uploaded documents and drafts stay in app memory. The website and Word add-in do not save them to browser storage or upload them to a server. The Word add-in loads Microsoft's Office.js runtime from its official CDN, but Writing Studio does not send document text to Microsoft or another service. The native app serves only bundled assets from an ephemeral loopback listener. Its Export TXT button opens the macOS Save panel and writes UTF-8 text only after Save; Cancel writes nothing. The website uses a local download after a user action.

## Limits

Autocomplete reuses wording found in the imported documents. It does not generate new semantic content. Rule-based rewrites use a small synonym and phrase list, so users should review each result before inserting it.

The Word task-pane add-in can insert a reviewed suggestion into the current Word selection. It requests `ReadWriteDocument` access and changes text only after the user clicks Insert or Replace. It checks that the Word selection has not changed before applying the edit.

## Project status

The native macOS app builds into `macos/dist/Writing Studio.app`. It wraps the existing local workspace in a nonpersistent WKWebView and serves bundled files from an ephemeral loopback-only listener. Its optional Accessibility mode starts off and currently supports TextEdit only. Word uses the separate task-pane add-in.

The website has not been deployed as a hosted service. The workspace layout was checked in Chromium and Safari. DOCX import was checked in Chromium only. The packaged Mac app loaded, imported a synthetic source, inserted a source-based suggestion, and saved a synthetic draft through the native Save panel. Cancel created no file. The Word add-in builds and its Node mock passes, but its live Word for Mac test is pending local certificate trust and sideload approval. Other browser engines need import review.

Until the DOCX parser has broader malformed-archive coverage, use synthetic or non-sensitive documents during this prototype phase.

## Run locally

Run the website from the `web` folder:

```sh
npm install
npm run dev
```

Build the frontend with:

```sh
npm run build
```

Build the macOS app from the repository root after building the web assets:

```sh
./macos/scripts/package.sh
```

See [the macOS app guide](macos/README.md) and [the Word add-in guide](web/word-addin/README.md) for local setup. The Word add-in needs a trusted localhost HTTPS certificate before it can run in Word.

## Integration limits

The Word Add-in loads Office.js from Microsoft's official CDN. It does not send Word text to a server. The systemwide Accessibility mode is off until the user enables it and supports TextEdit only. There is no Google Docs integration yet. Other app integrations need separate compatibility checks. Any future model feature must use a verified free API and free model, and must not send documents without an explicit user choice.

## License

The repository is published under the MIT license for the first open-source phase. Making it private later will not revoke the rights already granted to public copies.

See [CONTRIBUTING.md](CONTRIBUTING.md) for local development guidance and [SECURITY.md](SECURITY.md) for reporting a security issue.
