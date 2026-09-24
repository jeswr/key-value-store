import { assertKey, assertStringValue, namespacePrefix } from '@jeswr/key-value-core';
import type { KeyValueStore } from '@jeswr/key-value-core';

/** The subset of Bun.secrets this adapter uses; injectable for testing. */
export interface BunSecrets {
  get(options: { service: string; name: string }): Promise<string | null>;
  set(options: { service: string; name: string; value: string; persist: 'local' }): Promise<void>;
  delete(options: { service: string; name: string }): Promise<boolean>;
}

export interface BunSecretStoreOptions {
  namespace: string;
  secrets?: BunSecrets;
}

export function createBunSecretStore({ namespace, secrets }: BunSecretStoreOptions): KeyValueStore<string> {
  const service = namespacePrefix(namespace);
  const backend = secrets ?? (globalThis as { Bun?: { secrets?: BunSecrets } }).Bun?.secrets;
  if (!backend) throw new Error('Bun.secrets is unavailable. Use Bun with OS credential storage support.');
  const entry = (key: string) => { assertKey(key); return { service, name: JSON.stringify(key) }; };
  return {
    async getItem(key) { return backend.get(entry(key)); },
    async setItem(key, value) {
      assertStringValue(value);
      await backend.set({ ...entry(key), value, persist: 'local' });
    },
    async removeItem(key) { await backend.delete(entry(key)); },
  };
}
