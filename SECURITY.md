# Security policy

Writing Studio is an early local website. It is not deployed as a hosted service. Imported files are parsed in the browser and the app does not send document text to a server.

DOCX handling has not been checked against a broad malformed-archive set, and DOCX import has not been verified in Safari. Use synthetic or non-sensitive files during this prototype phase.

Report a suspected vulnerability through GitHub's private vulnerability reporting feature for this repository, when available. Do not post private documents, credentials, or exploit details in a public issue. If private reporting is unavailable, open an issue with a non-sensitive summary and request a private reporting path.

The security review and known limits are documented in [`docs/security-review.md`](docs/security-review.md).
