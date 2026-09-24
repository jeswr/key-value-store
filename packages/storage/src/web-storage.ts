import { assertKey, assertStringValue, namespacePrefix } from '@jeswr/key-value-core';
import type { ClearableStore } from '@jeswr/key-value-core';

/** Structurally compatible with localStorage and sessionStorage. */
export interface WebStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createWebStorageStore(
  storage: WebStorage, { namespace }: { namespace: string },
): ClearableStore<string> {
  const prefix = namespacePrefix(namespace);
  const scopedKey = (key: string): string => { assertKey(key); return prefix + key; };
  return {
    async getItem(key) { return storage.getItem(scopedKey(key)); },
    async setItem(key, value) { assertStringValue(value); storage.setItem(scopedKey(key), value); },
    async removeItem(key) { storage.removeItem(scopedKey(key)); },
    async clear() {
      const keys: string[] = [];
      for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (key !== null && key.startsWith(prefix)) keys.push(key);
      }
      for (const key of keys) storage.removeItem(key);
    },
  };
}
