# Contributing

Writing Studio is a local-first writing workspace. Keep document text and drafts in browser memory only.

## Development

```sh
cd web
npm ci
npm run dev
```

Before submitting a change, run:

```sh
npm run build
npm audit
```

Describe what changed and what you checked.

## Product boundaries

- Keep autocomplete and rewrite suggestions deterministic and local.
- Do not add AI APIs, document uploads, analytics, cloud storage, or browser persistence without a new product and privacy review.
- Keep imports bounded and parse untrusted documents in a Worker.
- Render document text as text, and show which source supplied a completion.
