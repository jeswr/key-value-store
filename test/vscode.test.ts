import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { createVSCodeSecretStore } from '@jeswr/key-value-vscode';
import type { VSCodeSecretStorage } from '@jeswr/key-value-vscode';
import { stringContract } from './helpers.ts';

function fakeSecrets(): VSCodeSecretStorage {
  const values = new Map<string, string>();
  return {
    async get(key) { return values.get(key); },
    async store(key, value) { values.set(key, value); },
    async delete(key) { values.delete(key); },
  };
}

stringContract('VS Code SecretStorage', () => createVSCodeSecretStore(fakeSecrets(), { namespace: 'contract' }));

test('VS Code namespaces share the host safely and do not expose clear', async () => {
  const host = fakeSecrets();
  const first = createVSCodeSecretStore(host, { namespace: 'a' });
  const same = createVSCodeSecretStore(host, { namespace: 'a' });
  const other = createVSCodeSecretStore(host, { namespace: 'a":"b' });
  await first.setItem('b:c', 'first');
  await other.setItem('c', 'other');
  assert.equal(await same.getItem('b:c'), 'first');
  await first.removeItem('b:c');
  assert.equal(await same.getItem('b:c'), null);
  assert.equal(await other.getItem('c'), 'other');
  assert.equal('clear' in first, false);
  assert.throws(() => createVSCodeSecretStore(host, { namespace: '' }), TypeError);
});

test('VS Code host failures reject unchanged instead of becoming misses', async () => {
  const error = new Error('host unavailable');
  const fail = async (): Promise<never> => { throw error; };
  const store = createVSCodeSecretStore({ get: fail, store: fail, delete: fail }, { namespace: 'failures' });
  await assert.rejects(store.getItem('key'), e => e === error);
  await assert.rejects(store.setItem('key', 'value'), e => e === error);
  await assert.rejects(store.removeItem('key'), e => e === error);
});

test('VS Code accepts PromiseLike results and waits for writes to finish', async () => {
  const host = fakeSecrets();
  let finish!: () => void;
  let writing!: () => void;
  const started = new Promise<void>(resolve => { writing = resolve; });
  host.store = () => {
    writing();
    const pending = new Promise<void>(resolve => { finish = resolve; });
    return { then: pending.then.bind(pending) };
  };
  const store = createVSCodeSecretStore(host, { namespace: 'thenable' });
  let settled = false;
  const write = store.setItem('key', 'value').then(() => { settled = true; });
  await started;
  assert.equal(settled, false);
  finish();
  await write;
  assert.equal(settled, true);
});

test('VS Code adapter bundles for a web extension without a host runtime dependency', async () => {
  const result = await build({
    stdin: { contents: "export { createVSCodeSecretStore } from '@jeswr/key-value-vscode';", resolveDir: process.cwd() },
    platform: 'browser', format: 'esm', bundle: true, write: false, metafile: true,
  });
  const inputs = Object.keys(result.metafile.inputs);
  assert.equal(inputs.some(path => path.includes('node_modules/')), false);
  assert.equal(inputs.some(path => path.endsWith('/vscode/dist/index.js')), true);
});
