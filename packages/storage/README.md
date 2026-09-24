# @jeswr/key-value-storage

Portable adapters with separate ESM entry points. Experimental; not yet published
to npm. See the [repository guide](https://github.com/jeswr/key-value-store#browser-storage).

```ts
import { createMemoryStore } from '@jeswr/key-value-storage/memory';
import { createWebStorageStore } from '@jeswr/key-value-storage/web-storage';
import { createIndexedDbStore } from '@jeswr/key-value-storage/indexeddb';

const memory = createMemoryStore<{ value: number }>();
const strings = createWebStorageStore(localStorage, { namespace: 'example:settings:v1' });
const structured = createIndexedDbStore<CryptoKey>({ namespace: 'example:keys:v1' });
```

Memory retains reference identity and owns its map. Web Storage accepts strings,
including `''`, and rejects unsupported values. IndexedDB uses `idb-keyval` and
accepts structured-cloneable values; each namespace owns a dedicated database.
Every adapter exposes `clear()` limited to its own storage scope.

Web Storage remains synchronous underneath the promise API. All backend errors
reject. Browser storage is not protection from malicious same-origin JavaScript,
and persistence is subject to browser quotas, permissions and eviction. IndexedDB
can retain non-extractable `CryptoKey` objects without exporting their material.
There is no root barrel import, and no native runtime dependencies are imported.
