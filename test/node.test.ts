import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createKeychainStore } from '@jeswr/key-value-node';
import type { KeychainStoreOptions } from '@jeswr/key-value-node';
import { stringContract } from './helpers.ts';

function fakeKeychain(): NonNullable<KeychainStoreOptions['createEntry']> {
  const values = new Map<string, string>();
  return ({ service, account, target, linux }) => {
    assert.equal(linux.store, 'secret-service');
    assert.deepEqual(JSON.parse(target), [service, account]);
    return {
      async getPassword() { return values.get(target); },
      async setPassword(value) { values.set(target, value); },
      async deleteCredential() { return values.delete(target); },
    };
  };
}
stringContract('Node keychain (injected)', () => createKeychainStore({ namespace: 'contract', createEntry: fakeKeychain() }));

test('Node keychain isolates namespaces and does not expose clear', async () => {
  const createEntry = fakeKeychain();
  const first = createKeychainStore({ namespace: 'one', createEntry });
  const second = createKeychainStore({ namespace: 'two', createEntry });
  await first.setItem('key', 'first');
  await second.setItem('key', 'second');
  await first.removeItem('key');
  assert.equal(await second.getItem('key'), 'second');
  assert.equal('clear' in first, false);
});

test('Node keychain propagates credential backend errors', async () => {
  const failure = new Error('locked');
  const fail = async (): Promise<never> => { throw failure; };
  const store = createKeychainStore({ namespace: 'errors', createEntry: () => ({
    getPassword: fail, setPassword: fail, deleteCredential: fail,
  }) });
  await assert.rejects(store.getItem('key'), (e) => e === failure);
  await assert.rejects(store.setItem('key', 'value'), (e) => e === failure);
  await assert.rejects(store.removeItem('key'), (e) => e === failure);
});

test('published native binding exposes the required API without accessing a vault', async () => {
  const { AsyncEntry } = await import('@napi-rs/keyring');
  assert.equal(typeof AsyncEntry.withTarget, 'function');
  assert.equal(typeof AsyncEntry.prototype.getPassword, 'function');
  assert.equal(typeof AsyncEntry.prototype.deleteCredential, 'function');
});
