# @jeswr/key-value-deno

An adapter for a caller-owned `Deno.Kv`. Experimental; not yet published to npm or
JSR. Tested with Deno 2.9.6 and `--unstable-kv`.

```ts
import { createDenoKvStore } from '@jeswr/key-value-deno';
const kv = await Deno.openKv();
try {
  const store = createDenoKvStore<{ value: number }>(kv, { namespace: 'example:v1' });
  await store.setItem('entry', { value: 42 });
} finally {
  kv.close();
}
```

Namespaces and exact keys use separate tuple components. Reads request strong
consistency. Values must be supported by Deno KV and top-level `null`/`undefined`
are rejected. The generic interface does not expose transactions or namespace
clearing. The adapter neither opens nor closes the database. Deno KV is general
persistence and makes no OS credential-vault guarantee.

See the [repository guide](https://github.com/jeswr/key-value-store#deno-kv).
