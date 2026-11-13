# Writing Studio: Product Design

Date: 2026-11-13

## Source idea

Todoist project: IDEAS/BACKLOG.

Idea title: “App that shows words in front of cursor so u can type and follow along. Autocomplete”

The Todoist item has no description.

## Goal

Build a standalone writing website that reads a user's own documents locally and suggests the next 3 to 10 words while they type. The user can accept a phrase, keep editing, or ask for a code-based rewrite of selected text.

The first phase is the website. A native Mac app that can insert text into Word, Google Docs, and other apps is a later phase.

## User and success outcome

The first users are people who write essays and other long documents. The main outcome is less repeated typing while the writer stays in control of the draft.

A first-use path must let a user add documents, type in an editor, see a source-backed continuation, accept or dismiss it with the keyboard, and export the draft.

## Approaches

1. Local-first website with deterministic suggestions. This keeps uploaded files in the browser and uses them for code-based phrase matching and rule-based rewrite suggestions. This is the recommended first phase because it works without an AI service, account, or API cost.
2. Cloud-first writing service. Upload documents to a server and send draft context for model suggestions. This could support richer semantic generation, but it stores and transmits private writing and needs account, retention, abuse, and cost controls. It is out of phase one.
3. Mac-first system utility. Build the cross-app insertion mechanism first. It is closer to the long-term goal, but skips the requested website phase and adds operating-system permission work.

## Selected phase-one design

### Workspace

- A standalone writing workspace, not a marketing wrapper.
- Desktop: source library on the left, writing surface in the center, suggestion inspector on the right.
- Mobile: one writing surface, with a source drawer and a bottom suggestion sheet.
- Use an editorial visual language with a readable serif for draft text, sans-serif controls, a deep pine source rail, sage selection states, and a restrained rust action color.
- Keep the editor, source list, autocomplete panel, rewrite state, empty state, loading state, import errors, and mobile layout accessible.

### Source import and autocomplete

- Accept TXT, Markdown, DOCX, and PDF.
- Parse files in the browser and keep extracted text in memory only. Use a dedicated Worker for DOCX/PDF parsing with a 15-second timeout and cancellation.
- Limit imports to 10 files, 10 MiB per file, 50 MiB aggregate input, 1 MiB extracted text per file, and 5 MiB total extracted text. Show parse errors by file.
- Search the in-memory text for a matching continuation based on words before the cursor.
- Return between 3 and 10 words, controlled by the user.
- Show the source filename for a matched phrase.
- Tab accepts the completion. Escape dismisses it. The user can also insert it with a visible button.
- Autocomplete uses phrase matching and word-frequency rules only. It does not call an AI service or send text to a remote API.
- Explain that suggestions work best when the uploaded documents contain related wording. The code will not create new semantic continuations.

### Code-based rewrite

- The user selects text and opens Rewrite selection.
- Generate local alternatives with a small, reviewed set of synonym and phrase rules.
- Label these as rule-based suggestions. Do not imply they come from a language model.
- Show suggestions for review. The user chooses whether to insert one into the draft.
- If the rules cannot produce a reasonable variation, say so and leave the source text unchanged.
- No network requests, model calls, account setup, or usage charges are part of phase one.

### Architecture

- React, TypeScript, Vite, Tailwind, shadcn, and Base UI.
- Local document parsing, phrase retrieval, and rule-based rewrite logic run in the browser.
- No API server, database, accounts, cloud document storage, analytics, or deployment in phase one.
- Use a shared TypeScript core for document tokenization and phrase matching so a later Mac app can reuse it.

### Later phases

- Phase two: native macOS writing utility.
- Phase three: explicit system-wide text insertion and Word/Google Docs support after reviewing accessibility permissions and operating-system behavior.
- Do not claim the website can insert text into every other app.
- If a future AI feature is needed, choose only a verified free API and free model. Recheck terms, quotas, privacy, and data retention before adding it.

## Design references

- Awwwards MCP search query: “writing editor productivity app”. No exact result matched.
- Awwwards MCP search query: “AI writing”. Relevant loose result: Rozalia Boma - Writer, slug rozalia-boma-writer. Adapt the personal, editorial typography and purposeful page motion as inspiration only. Do not copy its palette, assets, code, or branding.
- User-named product references: Grammarly for inline writing suggestions, and Microsoft Word/Google Docs for familiar document editing. Adapt interaction expectations without copying their screens or identity.

## Security and privacy invariants

- No uploaded document or draft leaves the browser.
- No document or draft is persisted by the website in this phase.
- Use the 10 MiB per-file, 50 MiB aggregate input, 1 MiB per-file extracted text, and 5 MiB total extracted text limits. Check extensions and file signatures before parsing. Run DOCX/PDF parsing in a Worker with a 15-second timeout.
- Render imported and rewritten text as text, not HTML.
- Do not log private text or filenames.
- Do not include credentials or remote-service code.
- Before public release, complete the applicable 70 core security checks and conditional checks, then review the implementation.

## License and publication

The user requested an open-source first phase, followed by a later private product. The initial license is MIT. Jeremy can use the code in a later private product. Anyone who receives a public copy keeps the MIT rights granted to that copy, even if the repository later becomes private. The repository includes the standard MIT license text.

## Evaluation

- The site builds locally.
- TXT, Markdown, DOCX, and PDF imports stay in browser memory.
- A source-backed phrase can be accepted with Tab and dismissed with Escape.
- The user can change the phrase length from 3 through 10 words.
- The user can review and insert a rule-based rewrite, or keep the original text.
- The draft can be exported after an explicit action.
- Import limits reject excess file count, input bytes, extracted text, and parser runtime without adding partial files.
- The desktop and mobile layouts preserve keyboard access and readable text.
- No AI, network calls, cloud account, paid usage, or document upload occurs during local verification.
