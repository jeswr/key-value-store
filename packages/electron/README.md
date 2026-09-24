# @jeswr/key-value-electron

A main-process adapter composing Electron `safeStorage` encryption with a
caller-owned `KeyValueStore<Uint8Array>` for ciphertext. Experimental; not yet
published to npm. There is no Electron runtime dependency or built-in file store.

```ts
import { app, safeStorage } from 'electron';
import type { KeyValueStore } from '@jeswr/key-value-core';
import { createElectronSecretStore } from '@jeswr/key-value-electron';

// Supply your application's existing durable byte store.
export async function openSecrets(ciphertexts: KeyValueStore<Uint8Array>) {
  await app.whenReady();
  return createElectronSecretStore(safeStorage, ciphertexts, {
    namespace: 'my-app:credentials:v1',
  });
}
```

The returned store accepts strings. Writes encrypt before persisting and resolve
after the backing write completes. Reads restore a Buffer from stored bytes
before decrypting. Missing entries return `null`; storage and encryption errors
reject. Only ciphertext is handed to the backing store; key names remain visible.
Protect its integrity, availability and durability as part of your application.
For JSON-only persistence, explicitly adapt bytes with a codec; never serialize a
Buffer implicitly and assume it will deserialize as bytes.

Namespaces share an existing backing store safely. The adapter does not expose
`clear()` because it cannot enumerate only its entries. Deletion and missing-entry
reads do not require decryption, so removal remains possible when the vault is
unavailable. There is no automatic migration, key rotation, or plaintext fallback.

## Encryption policy

Before every encryption or decryption operation, the adapter checks
`isEncryptionAvailable()`. On Linux it additionally requires a recognized
`gnome_libsecret`, `kwallet`, `kwallet5` or `kwallet6` backend. It refuses
`basic_text`, `unknown`, a missing backend-reporting API and unrecognized providers.
A newly supported upstream provider needs explicit review before adding it here.
The adapter never calls `setUsePlainTextEncryption` or changes global settings.

This version deliberately uses the synchronous safeStorage API so the Linux
backend policy can be checked against that API's selected backend. Its calls may
block or prompt even though the store's public methods return promises. Electron
recommends its newer asynchronous encryption API, but that API uses a separate
provider system; the synchronous backend selector cannot establish which async
provider is protecting the data. There is no automatic switch between formats.

Run this adapter in the main process, after `app.whenReady()`. Keep sensitive
operations there; expose only narrowly scoped, validated IPC operations to a
renderer rather than forwarding arbitrary secret reads. OS protection differs by
platform and does not protect secrets from an already-compromised application.
See [Electron's safeStorage documentation](https://www.electronjs.org/docs/latest/api/safe-storage).

Tests exercise the adapter with an isolated test cipher, unavailable/insecure
backend cases, corrupt data, persistence failures and published Electron type
declarations. They do not launch Electron or access the personal OS keychain.
