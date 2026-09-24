import { createDenoKvStore } from '@jeswr/key-value-deno';

Deno.test('actual Deno KV persists structured values and isolates namespaces', async () => {
  const kv = await Deno.openKv(':memory:');
  try {
    const first = createDenoKvStore<{ bytes: Uint8Array; nullable: null }>(kv, { namespace: 'first' });
    const second = createDenoKvStore<string>(kv, { namespace: 'second' });
    const check = (value: unknown, message: string) => { if (!value) throw new Error(message); };
    check(await first.getItem('missing') === null, 'Missing entry must be null');
    await first.setItem('https://x/a?x=1', { bytes: new Uint8Array([1, 2]), nullable: null });
    await second.setItem('https://x/a?x=1', 'independent');
    const restored = await first.getItem('https://x/a?x=1');
    check(restored?.bytes[1] === 2 && restored.nullable === null, 'Structured clone must round-trip');
    check(await first.getItem('https://x/a?x=2') === null, 'Keys must remain exact');
    await first.removeItem('https://x/a?x=1');
    await first.removeItem('https://x/a?x=1');
    check(await second.getItem('https://x/a?x=1') === 'independent', 'Namespaces must be isolated');
  } finally {
    kv.close();
  }
});
