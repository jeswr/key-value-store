import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withCodec, withExpiry, withNamespace } from '@jeswr/key-value-core';
import type { Codec, ExpiringValue } from '@jeswr/key-value-core';
import { createMemoryStore } from '@jeswr/key-value-storage/memory';

test('memory preserves falsy values, reference identity, and opaque keys', async () => {
  const store = createMemoryStore<{}>();
  const value = { nested: null };
  assert.equal(await store.getItem('missing'), null);
  for (const item of [false, 0, '', value]) {
    await store.setItem('key', item);
    assert.equal(await store.getItem('key'), item);
  }
  await store.setItem('https://x/a?x=1', 1);
  await store.setItem('https://x/a?x=2', 2);
  assert.equal(await store.getItem('https://x/a?x=1'), 1);
  assert.equal(await store.getItem('https://x/a?x=2'), 2);
  for (const invalid of [null, undefined]) {
    await assert.rejects(store.setItem('key', invalid as unknown as {}), TypeError);
    assert.equal(await store.getItem('key'), value);
  }
  await store.removeItem('key');
  await store.removeItem('key');
  assert.equal(await store.getItem('key'), null);
  await store.clear();
  assert.equal(await store.getItem('https://x/a?x=1'), null);
});

test('namespace composition prevents collisions and never forwards whole-store clear', async () => {
  const backing = createMemoryStore<string>();
  const a = withNamespace(backing, 'a');
  const b = withNamespace(backing, 'a":"b');
  await a.setItem('b:c', 'first');
  await b.setItem('c', 'second');
  assert.equal(await a.getItem('b:c'), 'first');
  assert.equal(await b.getItem('c'), 'second');
  assert.equal('clear' in a, false);
  assert.throws(() => withNamespace(backing, ''), TypeError);
});

const countCodec: Codec<{ count: number }, string> = {
  encode(value) { return JSON.stringify(value); },
  decode(text) {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object' || !('count' in value) || typeof value.count !== 'number') {
      throw new TypeError('Expected a count.');
    }
    return { count: value.count };
  },
};

test('codec validates decoded data, propagates failures, and preserves scoped clear', async () => {
  const backing = createMemoryStore<string>();
  const store = withCodec(backing, countCodec);
  assert.equal(await store.getItem('missing'), null);
  await store.setItem('key', { count: 0 });
  assert.equal(await backing.getItem('key'), '{"count":0}');
  assert.deepEqual(await store.getItem('key'), { count: 0 });
  await backing.setItem('invalid', '{"count":"zero"}');
  await assert.rejects(store.getItem('invalid'), TypeError);
  await store.clear();
  assert.equal(await backing.getItem('key'), null);
});

test('codec cannot encode or decode the absence sentinel', async () => {
  const backing = createMemoryStore<string>();
  const invalid = withCodec(backing, {
    encode() { return null as unknown as string; },
    decode() { return undefined as unknown as string; },
  });
  await assert.rejects(invalid.setItem('key', 'value'), TypeError);
  assert.equal(await backing.getItem('key'), null);
  await backing.setItem('key', 'value');
  await assert.rejects(invalid.getItem('key'), TypeError);
});

test('expiry boundaries, refresh, removal and scoped clear', async () => {
  let time = 100;
  const backing = createMemoryStore<ExpiringValue<string>>();
  const store = withExpiry(backing, { ttlMs: 10, now: () => time });
  await store.setItem('key', 'first');
  time = 109;
  assert.equal(await store.getItem('key'), 'first');
  time = 110;
  assert.equal(await store.getItem('key'), null);
  // Expiry is read filtering, not secure erasure or physical cleanup.
  assert.notEqual(await backing.getItem('key'), null);
  await store.setItem('key', 'second');
  assert.equal(await store.getItem('key'), 'second');
  await store.removeItem('key');
  assert.equal(await store.getItem('key'), null);
  await store.setItem('key', 'third');
  await store.clear();
  assert.equal(await backing.getItem('key'), null);
  for (const ttlMs of [0, -1, NaN, Infinity]) {
    assert.throws(() => withExpiry(backing, { ttlMs }), RangeError);
  }
});

test('an expired read does not delete a concurrently refreshed entry', async () => {
  const backing = createMemoryStore<ExpiringValue<string>>();
  await backing.setItem('key', { value: 'old', expiresAt: 0 });
  const originalGet = backing.getItem.bind(backing);
  backing.getItem = async (key) => {
    const old = await originalGet(key);
    await backing.setItem(key, { value: 'new', expiresAt: 100 });
    return old;
  };
  const store = withExpiry(backing, { ttlMs: 10, now: () => 5 });
  assert.equal(await store.getItem('key'), null);
  assert.equal((await originalGet('key'))?.value, 'new');
});

test('backend errors are not turned into misses by wrappers', async () => {
  const failure = new Error('locked');
  const fail = async (): Promise<never> => { throw failure; };
  const store = withNamespace(withCodec({ getItem: fail, setItem: fail, removeItem: fail }, countCodec), 'example');
  await assert.rejects(store.getItem('key'), (error) => error === failure);
  await assert.rejects(store.setItem('key', { count: 1 }), (error) => error === failure);
  await assert.rejects(store.removeItem('key'), (error) => error === failure);
});
