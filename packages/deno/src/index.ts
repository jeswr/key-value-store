import { assertKey, assertStoredValue, namespacePrefix } from '@key-value-kit/core';
import type { KeyValueStore, StoredValue } from '@key-value-kit/core';

/** Accepts a caller-owned Deno.Kv without depending on Deno ambient types. */
export interface DenoKv {
  get<T>(key: readonly string[], options: { consistency: 'strong' }): Promise<{ value: T | null }>;
  set(key: readonly string[], value: unknown): Promise<unknown>;
  delete(key: readonly string[]): Promise<void>;
}

export function createDenoKvStore<T extends StoredValue>(
  kv: DenoKv, { namespace }: { namespace: string },
): KeyValueStore<T> {
  const prefix = namespacePrefix(namespace);
  const scopedKey = (key: string): readonly string[] => { assertKey(key); return [prefix, key]; };
  return {
    async getItem(key) { return (await kv.get<T>(scopedKey(key), { consistency: 'strong' })).value; },
    async setItem(key, value) { assertStoredValue(value); await kv.set(scopedKey(key), value); },
    async removeItem(key) { await kv.delete(scopedKey(key)); },
  };
}
