# Key Value Store

A small asynchronous TypeScript storage contract with adapters for browsers,
Node.js, Bun, Deno, VS Code and Electron. Values are typed at the store level; adapters preserve
backend errors and never silently switch storage backends.

**Experimental prototype. The packages are prepared for distribution but have
not been published to npm.** Clone this repository and build the workspaces to
try them. Package names and APIs may change before a first release.

## Packages

| Package / import | Purpose | Values | `clear()` |
| --- | --- | --- | --- |
| `@jeswr/key-value-core` | Interfaces, namespaces, codecs and expiry | Backend-dependent | Preserved by codec/expiry wrappers |
| `@jeswr/key-value-storage/memory` | An instance-owned `Map` | JavaScript values by reference | Yes |
| `@jeswr/key-value-storage/web-storage` | `localStorage`, `sessionStorage`, compatible implementations | Strings | Only its namespace |
| `@jeswr/key-value-storage/indexeddb` | IndexedDB via `idb-keyval` | Structured-cloneable values | Only its namespace |
| `@jeswr/key-value-bun` | `Bun.secrets` OS credential storage | Strings | No |
| `@jeswr/key-value-node` | OS keychain via `@napi-rs/keyring` | Strings | No |
| `@jeswr/key-value-deno` | Caller-owned `Deno.Kv` | Deno KV-supported values | No |
| `@jeswr/key-value-vscode` | Caller-owned VS Code `SecretStorage` | Strings | No |
| `@jeswr/key-value-electron` | Electron `safeStorage` + caller-owned byte store | Strings | No |

The core has no runtime dependencies. Portable adapters have separate ESM export
paths, so importing memory or Web Storage does not load IndexedDB code. Native
keychain dependencies live in the Node package alone. No runtime auto-detection
or global storage access happens when modules are imported.

## Contract

```ts
export type StoredValue = NonNullable<unknown>;

export interface KeyValueStore<T extends StoredValue> {
  getItem(key: string): Promise<T | null>;
  setItem(key: string, value: T): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface ClearableStore<T extends StoredValue> extends KeyValueStore<T> {
  clear(): Promise<void>;
}

export interface Codec<T, Encoded> {
  encode(value: T): Encoded;
  decode(value: Encoded): T;
}
```

- Missing entries return `null`. Backend failures reject; they are never misses.
- Top-level `null` and `undefined` are rejected on writes. Nullable fields are fine.
- Writes create or replace entries and resolve after the backend operation
  completes. This is not an additional disk-flush or crash-durability guarantee.
- Removing a missing entry succeeds. Removing an inaccessible entry rejects.
- Keys are exact, case-sensitive strings. URLs are not parsed or normalized,
  including query strings. Backend limits can still cause a key or value to be
  rejected; keys are never truncated or hashed to work around limits.
- Every persistent adapter requires an explicit namespace. `clear()` affects only
  that store's namespace. Namespaces separate data; they are not access controls.
- The interface does not promise transactions, atomic read-modify-write, locks,
  cross-tab coordination, enumeration or background expiry cleanup. In particular,
  OAuth refresh-token rotation needs coordination beyond `getItem`/`setItem`.
- A generic type is a compile-time contract, not validation of stored data. Use a
  validating codec at serialization boundaries when the stored shape can change.

## Try it

```sh
git clone https://github.com/jeswr/key-value-store.git
cd key-value-store
npm ci
npm run build
npm run check
```

Use Node.js 22.18+ for development. Set `ELECTRON_SKIP_BINARY_DOWNLOAD=1`
in your environment when installing if you only need the tests: Electron is a
development dependency for its official type declarations, and these tests do not
need the runtime binary. Distribution files are ESM JavaScript and type
declarations; npm workspaces link the package imports locally. All examples below
use those imports. Consumers need only their chosen packages, not the monorepo's
development dependencies.

```ts
import { createMemoryStore } from '@jeswr/key-value-storage/memory';

const store = createMemoryStore<{ issuer: string }>();
await store.setItem('configuration', { issuer: 'https://issuer.example' });
console.log(await store.getItem('configuration'));
await store.removeItem('configuration');
```

### Browser storage

```ts
import { createWebStorageStore } from '@jeswr/key-value-storage/web-storage';
import { createIndexedDbStore } from '@jeswr/key-value-storage/indexeddb';

const preferences = createWebStorageStore(localStorage, { namespace: 'my-app:preferences:v1' });
await preferences.setItem('theme', 'dark');

const keys = createIndexedDbStore<CryptoKey>({ namespace: 'my-app:signing-keys:v1' });
const key = await crypto.subtle.generateKey(
  { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
);
await keys.setItem('signing-key', key);
```

IndexedDB uses a dedicated database for each namespace and delegates transaction
handling to [`idb-keyval`](https://github.com/jakearchibald/idb-keyval).
It preserves structured values such as non-extractable `CryptoKey` objects without
JSON serialization. Web Storage is string-only and synchronous underneath its
promise interface; the wrapper does not move work off the main thread. Storage
quota, privacy policies and browser eviction still apply.

### Explicit codecs

```ts
import { withCodec } from '@jeswr/key-value-core';
import type { Codec } from '@jeswr/key-value-core';
import { createWebStorageStore } from '@jeswr/key-value-storage/web-storage';

type Settings = { theme: 'light' | 'dark' };
function validate(value: unknown): Settings {
  if (typeof value !== 'object' || value === null || !('theme' in value)
      || (value.theme !== 'light' && value.theme !== 'dark')) {
    throw new TypeError('Invalid settings');
  }
  return { theme: value.theme };
}
const codec: Codec<Settings, string> = {
  encode: value => JSON.stringify(validate(value)),
  decode: text => validate(JSON.parse(text)),
};
const settings = withCodec(
  createWebStorageStore(localStorage, { namespace: 'my-app:settings:v1' }), codec,
);
await settings.setItem('appearance', { theme: 'dark' });
```

Codecs are synchronous transformations; exceptions become rejected store
operations. Choose a codec that represents the entire value you intend to retain.
`JSON.stringify` alone is not a validator and cannot preserve keys, functions,
cycles or all JavaScript value types. There is no implicit JSON codec.

### Expiry and namespace composition

```ts
import { withExpiry, withNamespace } from '@jeswr/key-value-core';
import type { ExpiringValue } from '@jeswr/key-value-core';
import { createMemoryStore } from '@jeswr/key-value-storage/memory';

const cache = withExpiry(
  createMemoryStore<ExpiringValue<{ issuer: string }>>(),
  { ttlMs: 60_000 },
);
await cache.setItem('metadata', { issuer: 'https://issuer.example' });

const backing = createMemoryStore<string>();
const scoped = withNamespace(backing, 'my-app');
await scoped.setItem('key', 'value');
```

`withExpiry` stores `{ value, expiresAt }` and returns `null` at or after expiry.
It does not delete during reads, which avoids deleting a concurrently refreshed
value. Expired records remain physically stored until removed, overwritten or
cleared. This wrapper is neither secure erasure nor token revocation. Persisted
expiry timestamps use wall-clock time; clock changes affect expiry.

`withNamespace` adds a collision-free prefix and deliberately does not forward
`clear()` because it cannot enumerate just its entries. Use an adapter's namespace
option when scoped clearing is needed. Codec and expiry wrappers preserve the
backing store's existing `clear()` capability.

### OS credential stores

```ts
// Bun
import { createBunSecretStore } from '@jeswr/key-value-bun';
const bunSecrets = createBunSecretStore({ namespace: 'my-app:credentials:v1' });

// Node.js
import { createKeychainStore } from '@jeswr/key-value-node';
const nodeSecrets = createKeychainStore({ namespace: 'my-app:credentials:v1' });
```

Bun delegates to [`Bun.secrets`](https://bun.sh/docs/runtime/secrets), which is an
experimental API. It requests local-device persistence on Windows. Node delegates
to [`@napi-rs/keyring`](https://github.com/Brooooooklyn/keyring-node), loading the
native binding on first use. On Linux the Node adapter explicitly requires Secret
Service, avoiding automatic fallback to the in-memory kernel keyring. Availability
can depend on an unlocked desktop session and installed native services.

Neither adapter silently falls back to a file, browser storage or memory. A
missing credential returns `null`; unavailable/locked stores reject. Account names
are quoted to preserve empty strings and control characters. Platform name and
value size limits still apply, including the namespace prefix. These stores are
intended for small string secrets, not general blobs or `CryptoKey` handles.

These packages do not promise a shared on-disk format between Bun and Node; OS
backend mappings can differ. Persisted namespace/key encoding is part of each
adapter's format and should be versioned before future migrations.

### VS Code and Electron

```ts
import { createVSCodeSecretStore } from '@jeswr/key-value-vscode';
// Inside your extension, using its ExtensionContext:
const secrets = createVSCodeSecretStore(context.secrets, { namespace: 'my-extension:v1' });
```

VS Code owns the storage and its security behavior. The adapter accepts its
Thenables, adds namespacing and preserves host errors, without importing the VS
Code runtime. See the [VS Code package](packages/vscode/README.md).

Electron supplies encryption rather than persistence. The
[Electron package](packages/electron/README.md) composes main-process `safeStorage`
with a byte store supplied by the application. It refuses unavailable encryption
and Linux's `basic_text` fallback. It uses the synchronous encryption API to check
that API's selected Linux backend; it can block despite the async store interface.
Its ciphertext backing store determines persistence, and key names remain visible.

### Deno KV

```ts
import { createDenoKvStore } from '@jeswr/key-value-deno';

const kv = await Deno.openKv();
try {
  const store = createDenoKvStore<{ issuer: string }>(kv, { namespace: 'my-app:metadata:v1' });
  await store.setItem('configuration', { issuer: 'https://issuer.example' });
} finally {
  kv.close(); // The caller owns the database lifecycle.
}
```

Deno KV uses a tuple of namespace and exact key. Reads request strong consistency;
the generic interface still does not expose transactions. Deno KV is general
persistence, not an OS credential vault. Enable `--unstable-kv` where required by
your Deno runtime. No JSR publication is included in this prototype.

## Choosing storage for authentication

| Data | Starting point |
| --- | --- |
| Public issuer metadata | IndexedDB in browsers, optionally wrapped with expiry |
| Short-lived access tokens | Memory unless application requirements justify persistence |
| Refresh tokens in a browser | Memory by default; opt-in persistent storage requires an application-specific threat model |
| Browser non-extractable signing keys | IndexedDB where supported |
| Small secrets in a desktop/CLI app | Bun secrets or the Node OS keychain adapter |
| General Deno application state | Deno KV |
| VS Code extension secrets | The extension's `context.secrets` via the VS Code adapter |
| Electron application secrets | Main-process `safeStorage` plus an application-owned ciphertext store |

Browser IndexedDB and Web Storage are accessible to same-origin script. A
non-extractable key prevents exporting private key material but does not prevent
malicious same-origin code from using the key to sign. Browser Credential
Management/WebAuthn APIs are not arbitrary token key-value stores. OS vaults can
improve protection at rest but do not make an already-compromised process safe.
There is intentionally no universal `secure: true` label or automatic persistent
default in this generic package.

## Validation

```sh
npm run check                 # Build, unit/contract tests and type checks
npx playwright install chromium
npm run test:browser          # Real Chromium storage, reload and bundling checks
npm run test:bun              # Actual Bun API availability, no vault writes
npm run test:deno             # Actual Deno in-memory KV integration
npm pack --workspaces --dry-run
```

The ordinary test suite uses injected credential backends and a native-binding
import smoke test. It does not write to your personal OS keychain. Browser tests
verify a non-extractable key remains usable after a reload. Deno integration uses
an isolated in-memory database. VS Code and Electron adapters use injected hosts
and compile-time checks against their published declarations. Successful mocks/import checks do not establish
that a particular machine has an unlocked, usable OS credential service.

CI runs the contract suite on Linux, macOS and Windows, Chromium integration on
Linux, and Bun and Deno runtime checks. No publishing workflow runs automatically.

## Scope

This project began as an extraction of configurable cache concerns from
[Reactive Authentication](https://github.com/solid-contrib/reactive-authentication).
Authentication cache key selection (issuer/account/resource/storage context),
logout coordination, refresh-token rotation and DPoP proof creation belong in the
consumer. This library stores exact keys supplied by that consumer.
