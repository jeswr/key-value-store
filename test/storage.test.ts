import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWebStorageStore } from '@key-value-kit/storage/web-storage';
import { createIndexedDbStore } from '@key-value-kit/storage/indexeddb';
import { memoryWebStorage, stringContract } from './helpers.ts';

stringContract('Web Storage', () => createWebStorageStore(memoryWebStorage(), { namespace: 'contract' }));

test('Web Storage clear isolates namespaces and unrelated application data', async () => {
  const storage = memoryWebStorage();
  storage.setItem('unrelated', 'keep');
  const first = createWebStorageStore(storage, { namespace: 'a' });
  const same = createWebStorageStore(storage, { namespace: 'a' });
  const other = createWebStorageStore(storage, { namespace: 'a":"b' });
  await first.setItem('b:c', 'first');
  await first.setItem('second', 'second');
  await other.setItem('c', 'other');
  assert.equal(await same.getItem('b:c'), 'first');
  await first.clear();
  assert.equal(await same.getItem('b:c'), null);
  assert.equal(await first.getItem('second'), null);
  assert.equal(await other.getItem('c'), 'other');
  assert.equal(storage.getItem('unrelated'), 'keep');
});

test('Web Storage reports quota and access errors as rejected promises', async () => {
  const storage = memoryWebStorage();
  const error = new Error('quota exceeded');
  storage.setItem = () => { throw error; };
  storage.getItem = () => { throw error; };
  const store = createWebStorageStore(storage, { namespace: 'errors' });
  await assert.rejects(store.setItem('key', 'value'), (e) => e === error);
  await assert.rejects(store.getItem('key'), (e) => e === error);
});

test('IndexedDB persists across instances, clones structured values and isolates clear', async () => {
  const namespace = 'structured';
  const first = createIndexedDbStore<{}>({ namespace });
  const same = createIndexedDbStore<{}>({ namespace });
  const other = createIndexedDbStore<{}>({ namespace: 'other' });
  const value = { bytes: new Uint8Array([1, 2]), nullable: null, date: new Date(100) };
  await first.setItem('key', value);
  value.bytes[0] = 9;
  assert.deepEqual(await same.getItem('key'), { bytes: new Uint8Array([1, 2]), nullable: null, date: new Date(100) });
  for (const item of [false, 0, '']) {
    await first.setItem('falsy', item);
    assert.equal(await same.getItem('falsy'), item);
  }
  await first.setItem('https://x/a?x=1', 1);
  await first.setItem('https://x/a?x=2', 2);
  assert.equal(await same.getItem('https://x/a?x=1'), 1);
  assert.equal(await same.getItem('https://x/a?x=2'), 2);
  for (const invalid of [null, undefined]) {
    await assert.rejects(first.setItem('key', invalid as unknown as {}), TypeError);
  }
  await assert.rejects(first.setItem('bad', () => 1), { name: 'DataCloneError' });
  await first.removeItem('key');
  await first.removeItem('key');
  assert.equal(await same.getItem('key'), null);
  await other.setItem('key', 'keep');
  await first.clear();
  assert.equal(await same.getItem('falsy'), null);
  assert.equal(await other.getItem('key'), 'keep');
});

test('IndexedDB retains a non-extractable CryptoKey usable for signing', async () => {
  const store = createIndexedDbStore<CryptoKey>({ namespace: 'crypto' });
  const key = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  await store.setItem('key', key);
  const restored = await createIndexedDbStore<CryptoKey>({ namespace: 'crypto' }).getItem('key');
  assert.ok(restored);
  assert.equal(restored.extractable, false);
  const data = new TextEncoder().encode('message');
  const signature = await crypto.subtle.sign('HMAC', restored, data);
  assert.equal(await crypto.subtle.verify('HMAC', key, signature, data), true);
  await assert.rejects(crypto.subtle.exportKey('raw', restored));
});
