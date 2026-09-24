import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { once } from 'node:events';
import { build } from 'esbuild';
import { expect, test } from '@playwright/test';

let server: Server;
let origin: string;

test.beforeAll(async () => {
  const bundle = await build({
    stdin: {
      contents: `export { createWebStorageStore } from '@jeswr/key-value-storage/web-storage';
        export { createIndexedDbStore } from '@jeswr/key-value-storage/indexeddb';`,
      resolveDir: process.cwd(),
    },
    bundle: true, format: 'esm', platform: 'browser', write: false,
  });
  server = createServer((req, res) => {
    if (req.url === '/adapters.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(bundle.outputFiles[0]!.text);
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end('<!doctype html><title>Storage integration tests</title>');
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP address.');
  origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  if (server?.listening) await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test('localStorage and sessionStorage persist across reload and clear only their namespace', async ({ page }) => {
  await page.goto(origin);
  await page.evaluate(async () => {
    const { createWebStorageStore } = await import(new URL('/adapters.js', location.href).href);
    for (const storage of [localStorage, sessionStorage]) {
      storage.setItem('unrelated', 'keep');
      const store = createWebStorageStore(storage, { namespace: 'first' });
      await store.setItem('https://x/a?x=1', 'one');
      await store.setItem('https://x/a?x=2', 'two');
      await createWebStorageStore(storage, { namespace: 'second' }).setItem('key', 'keep');
    }
  });
  await page.reload();
  const result = await page.evaluate(async () => {
    const { createWebStorageStore } = await import(new URL('/adapters.js', location.href).href);
    const results = [];
    for (const storage of [localStorage, sessionStorage]) {
      const store = createWebStorageStore(storage, { namespace: 'first' });
      const before = [await store.getItem('https://x/a?x=1'), await store.getItem('https://x/a?x=2')];
      await store.clear();
      results.push({ before, after: await store.getItem('https://x/a?x=1'),
        other: await createWebStorageStore(storage, { namespace: 'second' }).getItem('key'),
        unrelated: storage.getItem('unrelated') });
    }
    return results;
  });
  expect(result).toEqual([0, 1].map(() => ({ before: ['one', 'two'], after: null, other: 'keep', unrelated: 'keep' })));
});

test('IndexedDB retains a non-extractable signing key across a page reload', async ({ page }) => {
  await page.goto(origin);
  await page.evaluate(async () => {
    const { createIndexedDbStore } = await import(new URL('/adapters.js', location.href).href);
    const key = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
    await createIndexedDbStore({ namespace: 'keys' }).setItem('key', key);
    await createIndexedDbStore({ namespace: 'other' }).setItem('key', 'keep');
  });
  await page.reload();
  const result = await page.evaluate(async () => {
    const { createIndexedDbStore } = await import(new URL('/adapters.js', location.href).href);
    const store = createIndexedDbStore({ namespace: 'keys' });
    const key = await store.getItem('key');
    const data = new TextEncoder().encode('signed after reload');
    const signature = await crypto.subtle.sign('HMAC', key, data);
    const verified = await crypto.subtle.verify('HMAC', key, signature, data);
    let exportRejected = false;
    try { await crypto.subtle.exportKey('raw', key); } catch { exportRejected = true; }
    await store.clear();
    return { verified, extractable: key.extractable, exportRejected,
      removed: await store.getItem('key'),
      other: await createIndexedDbStore({ namespace: 'other' }).getItem('key') };
  });
  expect(result).toEqual({ verified: true, extractable: false, exportRejected: true, removed: null, other: 'keep' });
});

test('the memory entry point bundles without IndexedDB or native dependencies', async () => {
  const result = await build({
    stdin: { contents: `export { createMemoryStore } from '@jeswr/key-value-storage/memory';`, resolveDir: process.cwd() },
    bundle: true, format: 'esm', platform: 'browser', write: false, metafile: true,
  });
  const inputs = Object.keys(result.metafile.inputs);
  expect(inputs.some((path) => /idb-keyval|keyring|packages\/(bun|node|deno)\//.test(path))).toBe(false);
  expect(inputs.some((path) => path.endsWith('/memory.js'))).toBe(true);
});
