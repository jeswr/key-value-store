import { assertKey, assertStringValue, namespacePrefix } from '@jeswr/key-value-core';
import type { KeyValueStore } from '@jeswr/key-value-core';

/** Structurally compatible with ExtensionContext.secrets, including VS Code Thenables. */
export interface VSCodeSecretStorage {
  get(key: string): PromiseLike<string | undefined>;
  store(key: string, value: string): PromiseLike<void>;
  delete(key: string): PromiseLike<void>;
}

/** The host owns persistence and security; no VS Code runtime import is required. */
export function createVSCodeSecretStore(
  secrets: VSCodeSecretStorage, { namespace }: { namespace: string },
): KeyValueStore<string> {
  const prefix = namespacePrefix(namespace);
  const scopedKey = (key: string): string => { assertKey(key); return prefix + key; };
  return {
    async getItem(key) { return (await secrets.get(scopedKey(key))) ?? null; },
    async setItem(key, value) { assertStringValue(value); await secrets.store(scopedKey(key), value); },
    async removeItem(key) { await secrets.delete(scopedKey(key)); },
  };
}
