import { expect, test } from 'bun:test';
import { secrets } from 'bun';
import { createBunSecretStore } from '@jeswr/key-value-bun';

test('the actual Bun secrets API can instantiate the adapter without keychain access', () => {
  expect(typeof secrets.get).toBe('function');
  expect(typeof secrets.set).toBe('function');
  expect(typeof secrets.delete).toBe('function');
  const store = createBunSecretStore({ namespace: 'runtime-smoke' });
  expect(typeof store.getItem).toBe('function');
});
