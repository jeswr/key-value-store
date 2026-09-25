# @key-value-kit/node

An OS keychain adapter backed by `@napi-rs/keyring`. Experimental alpha (`0.1.0-alpha.0`). Requires Node.js 22.18+ and a working OS credential backend.

```ts
import { createKeychainStore } from '@key-value-kit/node';
const store = createKeychainStore({ namespace: 'example:credentials:v1' });
await store.setItem('refresh-token', 'secret');
```

The native binding loads on first operation. Linux explicitly requires Secret
Service and will reject if it is unavailable instead of falling back to the kernel
keyring. Other platforms use the binding's OS credential backend. Values are
strings, missing entries return `null`, and backend errors reject. No `clear()`
is exposed. OS size/name limits still apply; this is not general blob storage.

An optional `createEntry` factory accepts a collision-free target, service,
quoted account and strict Linux options. It supports testing or an explicitly
supplied compatible vault. The adapter's guarantees depend on that supplied
backend honoring the contract. Default tests use injected entries and verify the
native API can import without writing personal credentials.

See the [repository guide](https://github.com/jeswr/key-value-store#os-credential-stores).
