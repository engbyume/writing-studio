# Contributing

Writing Studio is a local-first writing workspace. Keep document text and drafts in app or Word task-pane memory only.

## Development

```sh
cd web
npm ci
npm run dev
```

From `web`, build the site, audit dependencies, and build the Word task pane:

```sh
npm run build
npm audit
./node_modules/.bin/tsc -p word-addin/tsconfig.json
./node_modules/.bin/vite build --config word-addin/vite.config.ts
```

From the repository root, package the native macOS app after the web build:

```sh
./macos/scripts/package.sh
```

Describe what changed and what you checked.

## Product boundaries

- Keep autocomplete and rewrite suggestions deterministic and local.
- Do not add AI APIs, remote document uploads, analytics, cloud storage, or browser persistence without a new product and privacy review.
- Keep the Office.js runtime limited to Microsoft's official CDN. Do not send Word document text to a server.
- Keep Accessibility integration disabled until the user enables it. Do not add Input Monitoring or global key capture.
- Keep imports bounded and parse untrusted documents in a Worker.
- Render document text as text, and show which source supplied a completion.
