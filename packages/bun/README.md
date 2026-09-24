# @jeswr/key-value-bun

An adapter for Bun's experimental OS credential storage API. Experimental; not yet
published to npm. Tested with Bun 1.3.13.

```ts
import { createBunSecretStore } from '@jeswr/key-value-bun';
const store = createBunSecretStore({ namespace: 'example:credentials:v1' });
await store.setItem('refresh-token', 'secret');
```

Accepts strings; use an explicit codec for other types. Calls `Bun.secrets` and
requests `persist: 'local'`. Missing entries return `null`; access/availability
errors reject. No enumeration or `clear()` is exposed. Namespace and encoded key
lengths and secret sizes remain subject to OS limits. No plaintext fallback.

Pass a `secrets: BunSecrets` implementation for testing or explicit dependency
injection. Default tests check the real API shape and use injected backends for
CRUD, without touching your OS vault. See the
[repository guide](https://github.com/jeswr/key-value-store#os-credential-stores).
