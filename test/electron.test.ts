import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { namespacePrefix } from '@jeswr/key-value-core';
import { createMemoryStore } from '@jeswr/key-value-storage/memory';
import { createElectronSecretStore } from '@jeswr/key-value-electron';
import type { ElectronSafeStorage } from '@jeswr/key-value-electron';
import { stringContract } from './helpers.ts';

// An isolated test cipher, not Electron's OS-backed implementation.
function fakeSafeStorage(): ElectronSafeStorage {
  const key = randomBytes(32);
  return {
    isEncryptionAvailable() { return true; },
    getSelectedStorageBackend() { return 'gnome_libsecret'; },
    encryptString(value) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
    },
    decryptString(value) {
      assert.equal(Buffer.isBuffer(value), true, 'Electron receives a Buffer even when the store returns a Uint8Array');
      const bytes = Buffer.from(value);
      const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      cipher.setAuthTag(bytes.subarray(12, 28));
      return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8');
    },
  };
}

stringContract('Electron safeStorage composition', () => createElectronSecretStore(
  fakeSafeStorage(), createMemoryStore<Uint8Array>(), { namespace: 'contract' },
));

test('Electron stores only ciphertext and reopens it through an independent adapter', async () => {
  const safeStorage = fakeSafeStorage();
  const bytes = createMemoryStore<Uint8Array>();
  const store = createElectronSecretStore(safeStorage, bytes, { namespace: 'app' });
  await store.setItem('token', 'sensitive-value');
  const key = namespacePrefix('app') + 'token';
  const encrypted = await bytes.getItem(key);
  assert.ok(encrypted);
  assert.equal(Buffer.from(encrypted).includes('sensitive-value'), false);
  await bytes.setItem(key, new Uint8Array(encrypted));
  const reopened = createElectronSecretStore(safeStorage, bytes, { namespace: 'app' });
  assert.equal(await reopened.getItem('token'), 'sensitive-value');
  const other = createElectronSecretStore(safeStorage, bytes, { namespace: 'other' });
  await other.setItem('token', 'keep');
  await store.removeItem('token');
  assert.equal(await reopened.getItem('token'), null);
  assert.equal(await other.getItem('token'), 'keep');
  assert.equal('clear' in store, false);
});

test('Electron rechecks backend protection and allows deletion when encryption is unavailable', async () => {
  const safeStorage = fakeSafeStorage();
  const bytes = createMemoryStore<Uint8Array>();
  const store = createElectronSecretStore(safeStorage, bytes, { namespace: 'gating' });
  await store.setItem('key', 'existing');
  const encrypted = await bytes.getItem(namespacePrefix('gating') + 'key');
  for (const backend of ['basic_text', 'unknown', 'future-unverified-backend']) {
    safeStorage.getSelectedStorageBackend = () => backend;
    await assert.rejects(store.setItem('key', 'replacement'), /backend/);
    await assert.rejects(store.getItem('key'), /backend/);
    assert.equal(await bytes.getItem(namespacePrefix('gating') + 'key'), encrypted);
  }
  safeStorage.isEncryptionAvailable = () => false;
  await assert.rejects(store.setItem('key', 'replacement'), /unavailable/);
  await assert.rejects(store.getItem('key'), /unavailable/);
  await store.removeItem('key');
  assert.equal(await store.getItem('key'), null);
});

test('Electron on Linux refuses a backend that cannot report its selected provider', { skip: process.platform !== 'linux' }, async () => {
  const safeStorage = fakeSafeStorage();
  delete safeStorage.getSelectedStorageBackend;
  const store = createElectronSecretStore(safeStorage, createMemoryStore<Uint8Array>(), { namespace: 'unknown' });
  await assert.rejects(store.setItem('key', 'value'), /backend/);
});

test('Electron on macOS and Windows does not require the Linux-only API', { skip: process.platform === 'linux' }, async () => {
  const safeStorage = fakeSafeStorage();
  delete safeStorage.getSelectedStorageBackend;
  const store = createElectronSecretStore(safeStorage, createMemoryStore<Uint8Array>(), { namespace: 'native' });
  await store.setItem('key', 'value');
  assert.equal(await store.getItem('key'), 'value');
});

test('Electron rejects corrupt ciphertext and propagates encryption failures without writing', async () => {
  const safeStorage = fakeSafeStorage();
  const bytes = createMemoryStore<Uint8Array>();
  const store = createElectronSecretStore(safeStorage, bytes, { namespace: 'corrupt' });
  await bytes.setItem(namespacePrefix('corrupt') + 'key', new Uint8Array([0, 1]));
  await assert.rejects(store.getItem('key'));
  const error = new Error('OS vault locked');
  safeStorage.encryptString = () => { throw error; };
  await assert.rejects(store.setItem('new', 'value'), e => e === error);
  assert.equal(await bytes.getItem(namespacePrefix('corrupt') + 'new'), null);
});

test('Electron propagates backing storage failures and waits for persistence', async () => {
  const bytes = createMemoryStore<Uint8Array>();
  const error = new Error('disk unavailable');
  const fail = async (): Promise<never> => { throw error; };
  const store = createElectronSecretStore(fakeSafeStorage(), bytes, { namespace: 'disk' });
  bytes.getItem = fail;
  bytes.setItem = fail;
  bytes.removeItem = fail;
  await assert.rejects(store.getItem('key'), e => e === error);
  await assert.rejects(store.setItem('key', 'value'), e => e === error);
  await assert.rejects(store.removeItem('key'), e => e === error);
  let finish!: () => void;
  let started!: () => void;
  const writing = new Promise<void>(resolve => { started = resolve; });
  bytes.setItem = () => { started(); return new Promise(resolve => { finish = resolve; }); };
  let settled = false;
  const write = store.setItem('key', 'value').then(() => { settled = true; });
  await writing;
  assert.equal(settled, false);
  finish();
  await write;
  assert.equal(settled, true);
});
