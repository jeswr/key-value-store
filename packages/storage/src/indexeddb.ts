import { clear, createStore, del, get, set } from 'idb-keyval';
import { assertKey, assertStoredValue, namespacePrefix } from '@jeswr/key-value-core';
import type { ClearableStore, StoredValue } from '@jeswr/key-value-core';

/** Each namespace owns a dedicated database, including its clear operation. */
export function createIndexedDbStore<T extends StoredValue>(
  { namespace }: { namespace: string },
): ClearableStore<T> {
  const store = createStore(namespacePrefix(namespace), 'entries');
  return {
    async getItem(key) { assertKey(key); return (await get<T>(key, store)) ?? null; },
    async setItem(key, value) { assertKey(key); assertStoredValue(value); await set(key, value, store); },
    async removeItem(key) { assertKey(key); await del(key, store); },
    async clear() { await clear(store); },
  };
}
