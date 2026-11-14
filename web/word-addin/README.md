# Writing Studio for Word

This is a local Word task-pane add-in. It reuses the Writing Studio phrase matcher, rule-based rewrites, and bounded document parser. Imported sources stay in the task pane's memory. The add-in reads only the current main-document paragraph and inserts or replaces text only after the user clicks a button.

The XML manifest requests `ReadWriteDocument`, which grants document-wide read and write access while the add-in is active. The pane limits reads to one main-document paragraph and inserts only after the user clicks. It checks that the Word range is unchanged before it writes. It uses WordApiDesktop 1.4 for cursor offsets and shows a limited-support message on older hosts.

The task pane loads Microsoft's Office.js runtime from the official CDN. Writing Studio does not send Word content to a network service.

## Build

From `web`:

```sh
./node_modules/.bin/tsc -p word-addin/tsconfig.json
./node_modules/.bin/vite build --config word-addin/vite.config.ts
```

## Local Word test

The manifest points to `https://localhost:3001/`. The preview server requires a trusted localhost HTTPS certificate and reads its file paths from `WRITING_STUDIO_WORD_CERT` and `WRITING_STUDIO_WORD_KEY`. Keep certificate and key files outside the repository or in the ignored `certs/` folder. Never commit them.

```sh
WRITING_STUDIO_WORD_CERT=/path/to/localhost.pem \
WRITING_STUDIO_WORD_KEY=/path/to/localhost-key.pem \
./node_modules/.bin/vite preview --config word-addin/vite.config.ts
```

Follow [Microsoft's Mac sideloading guide](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-an-office-add-in-on-mac) to install `manifest.xml` in Word's local `wef` folder. Word may need to reload the add-in list. Remove the manifest when you finish local testing.

Use the synthetic file in [`examples/synthetic-migration-source.txt`](examples/synthetic-migration-source.txt) with an unsaved Word test document. The TypeScript build and a Node mock pass. Live Word UI verification is still pending.
