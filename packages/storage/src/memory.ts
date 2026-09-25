import { assertKey, assertStoredValue } from '@key-value-kit/core';
import type { ClearableStore, StoredValue } from '@key-value-kit/core';

/** Each instance owns its map. Values retain JavaScript reference identity. */
export function createMemoryStore<T extends StoredValue>(): ClearableStore<T> {
  const values = new Map<string, T>();
  return {
    async getItem(key) { assertKey(key); return values.get(key) ?? null; },
    async setItem(key, value) { assertKey(key); assertStoredValue(value); values.set(key, value); },
    async removeItem(key) { assertKey(key); values.delete(key); },
    async clear() { values.clear(); },
  };
}
