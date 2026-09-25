import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { KeyValueStore } from '@key-value-kit/core';
import type { WebStorage } from '@key-value-kit/storage/web-storage';

export function stringContract(name: string, create: () => KeyValueStore<string>): void {
  test(`${name}: shared string store contract`, async () => {
    const store = create();
    assert.equal(await store.getItem('missing'), null);
    await store.removeItem('missing');
    const keys = ['', 'https://pod.example/a?x=1', 'https://pod.example/a?x=2',
      '/a', ':a', 'A', 'a', '__proto__', 'a\u0000b', '💾'];
    for (const key of keys) {
      assert.equal(await store.setItem(key, key), undefined);
    }
    for (const key of keys) assert.equal(await store.getItem(key), key);
    await store.setItem('a', 'replacement');
    assert.equal(await store.getItem('a'), 'replacement');
    for (const value of [null, undefined, 42, {}]) {
      await assert.rejects(store.setItem('a', value as unknown as string), TypeError);
      assert.equal(await store.getItem('a'), 'replacement');
    }
    for (const key of keys) await store.removeItem(key);
    for (const key of keys) assert.equal(await store.getItem(key), null);
    assert.equal(await store.removeItem('a'), undefined);
  });
}

export function memoryWebStorage(): WebStorage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
}
