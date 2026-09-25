# Development

Use Node.js 22.18+ and npm. Run `npm ci`, `npm run check`, and the browser tests
before changing the storage contract. Run the affected runtime integration tests
when changing a Bun or Deno adapter. Keep platform-specific dependencies within
their own package and keep portable entry points importable without browser globals.

Adapting a backend requires three methods: `getItem`, `setItem`, `removeItem`.
Expose additional capabilities only when the adapter can provide their documented
semantics. Do not map access errors to missing entries or silently fall back to
another persistence/security model. Preserve keys exactly or fail on backend
limits; do not normalize URLs.

Build with `npm run build` before packing individual workspaces. Packages use
`@key-value-kit` and are versioned together at `0.1.0-alpha.0`. Adapter dependencies
pin the matching alpha core version exactly. Public publishing targets the `alpha`
dist-tag, never `latest`. Follow [RELEASING.md](RELEASING.md) for the ordered release
commands and verification. There is no automated npm publishing or JSR setup.

Generated `dist` output is ignored by Git but included in npm package tarballs.
Tests run against that output so package export paths are exercised. Native OS
vault integration tests must use a disposable test vault; do not add tests that
write a developer's personal credentials.
