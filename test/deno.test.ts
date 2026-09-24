import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDenoKvStore } from '@jeswr/key-value-deno';
import type { DenoKv } from '@jeswr/key-value-deno';

function fakeKv(): DenoKv {
  const values = new Map<string, unknown>();
  return {
    async get<T>(key: readonly string[], options: { consistency: 'strong' }) {
      assert.equal(options.consistency, 'strong');
      return { value: (values.get(JSON.stringify(key)) ?? null) as T | null };
    },
    async set(key, value) { values.set(JSON.stringify(key), structuredClone(value)); },
    async delete(key) { values.delete(JSON.stringify(key)); },
  };
}

test('Deno KV namespaces, falsy values and rejection of absence sentinels', async () => {
  const kv = fakeKv();
  const first = createDenoKvStore<{}>(kv, { namespace: 'one' });
  const second = createDenoKvStore<{}>(kv, { namespace: 'two' });
  assert.equal(await first.getItem('missing'), null);
  for (const value of [false, 0, '', { nullable: null }]) {
    await first.setItem('key', value);
    assert.deepEqual(await first.getItem('key'), value);
  }
  await second.setItem('key', 'keep');
  for (const invalid of [null, undefined]) {
    await assert.rejects(first.setItem('key', invalid as unknown as {}), TypeError);
  }
  await first.removeItem('key');
  await first.removeItem('key');
  assert.equal(await first.getItem('key'), null);
  assert.equal(await second.getItem('key'), 'keep');
  assert.equal('clear' in first, false);
});
