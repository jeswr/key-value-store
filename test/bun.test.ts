import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBunSecretStore } from '@key-value-kit/bun';
import type { BunSecrets } from '@key-value-kit/bun';
import { stringContract } from './helpers.ts';

function fakeSecrets(): BunSecrets {
  const values = new Map<string, string>();
  const key = (options: { service: string; name: string }) => JSON.stringify([options.service, options.name]);
  return {
    async get(options) { return values.get(key(options)) ?? null; },
    async set(options) { assert.equal(options.persist, 'local'); values.set(key(options), options.value); },
    async delete(options) { return values.delete(key(options)); },
  };
}
stringContract('Bun secrets (injected)', () => createBunSecretStore({ namespace: 'contract', secrets: fakeSecrets() }));

test('Bun namespaces are independent, and clear is not advertised', async () => {
  const secrets = fakeSecrets();
  const first = createBunSecretStore({ namespace: 'one', secrets });
  const second = createBunSecretStore({ namespace: 'two', secrets });
  await first.setItem('key', 'first');
  await second.setItem('key', 'second');
  await first.removeItem('key');
  assert.equal(await second.getItem('key'), 'second');
  assert.equal('clear' in first, false);
});

test('Bun propagates locked or unavailable backend errors', async () => {
  const failure = new Error('locked');
  const fail = async (): Promise<never> => { throw failure; };
  const store = createBunSecretStore({ namespace: 'errors', secrets: { get: fail, set: fail, delete: fail } });
  await assert.rejects(store.getItem('key'), (e) => e === failure);
  await assert.rejects(store.setItem('key', 'value'), (e) => e === failure);
  await assert.rejects(store.removeItem('key'), (e) => e === failure);
});
