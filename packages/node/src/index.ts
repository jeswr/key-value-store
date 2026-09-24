import { assertKey, assertStringValue, namespacePrefix } from '@jeswr/key-value-core';
import type { KeyValueStore } from '@jeswr/key-value-core';

export interface KeychainEntry {
  getPassword(): Promise<string | undefined>;
  setPassword(value: string): Promise<void>;
  deleteCredential(): Promise<boolean>;
}

export interface KeychainEntryOptions {
  target: string;
  service: string;
  account: string;
  linux: { store: 'secret-service' };
}

export interface KeychainStoreOptions {
  namespace: string;
  /** Override the native binding for testing or a compatible OS vault. */
  createEntry?: (options: KeychainEntryOptions) => KeychainEntry | Promise<KeychainEntry>;
}

async function nativeEntry({ target, service, account, linux }: KeychainEntryOptions): Promise<KeychainEntry> {
  // Native bindings are loaded only when an operation is first performed.
  const { AsyncEntry } = await import('@napi-rs/keyring');
  return AsyncEntry.withTarget(target, service, account, { linux });
}

export function createKeychainStore({ namespace, createEntry = nativeEntry }: KeychainStoreOptions): KeyValueStore<string> {
  const service = namespacePrefix(namespace);
  const entry = (key: string) => {
    assertKey(key);
    // Quoting preserves empty keys and escapes embedded control characters.
    const account = JSON.stringify(key);
    return createEntry({
      target: JSON.stringify([service, account]), service, account,
      linux: { store: 'secret-service' },
    });
  };
  return {
    async getItem(key) { return (await (await entry(key)).getPassword()) ?? null; },
    async setItem(key, value) {
      assertStringValue(value);
      await (await entry(key)).setPassword(value);
    },
    async removeItem(key) { await (await entry(key)).deleteCredential(); },
  };
}
