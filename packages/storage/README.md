# @key-value-kit/storage

Portable adapters with separate ESM entry points. Experimental alpha (`0.1.0-alpha.0`). See the [repository guide](https://github.com/jeswr/KeyValueKit#browser-storage).

```ts
import { createMemoryStore } from '@key-value-kit/storage/memory';
import { createWebStorageStore } from '@key-value-kit/storage/web-storage';
import { createIndexedDbStore } from '@key-value-kit/storage/indexeddb';

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
