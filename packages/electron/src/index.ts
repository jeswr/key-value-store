import { Buffer } from 'node:buffer';
import { platform } from 'node:process';
import { assertStringValue, withCodec, withNamespace } from '@jeswr/key-value-core';
import type { KeyValueStore } from '@jeswr/key-value-core';

/** The synchronous safeStorage API. The actual Electron object can be passed directly. */
export interface ElectronSafeStorage {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Uint8Array;
  decryptString(value: Uint8Array): string;
  /** Present only on Linux at runtime. */
  getSelectedStorageBackend?(): string;
}

const protectedLinuxBackends = new Set(['gnome_libsecret', 'kwallet', 'kwallet5', 'kwallet6']);

/** Main-process adapter; call after app.whenReady(). Persistence belongs to ciphertexts. */
export function createElectronSecretStore(
  safeStorage: ElectronSafeStorage,
  ciphertexts: KeyValueStore<Uint8Array>,
  { namespace }: { namespace: string },
): KeyValueStore<string> {
  const requireEncryption = (): void => {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Electron safeStorage encryption is unavailable. Wait for app readiness and unlock the OS credential store.');
    }
    const backend = safeStorage.getSelectedStorageBackend?.();
    if ((platform === 'linux' || backend !== undefined) && !protectedLinuxBackends.has(backend ?? '')) {
      throw new Error('Electron safeStorage requires a supported OS credential backend; basic_text, unknown, and unrecognized backends are refused.');
    }
  };
  return withCodec(withNamespace(ciphertexts, namespace), {
    encode(value: string): Uint8Array {
      assertStringValue(value);
      requireEncryption();
      return safeStorage.encryptString(value);
    },
    decode(value: Uint8Array): string {
      requireEncryption();
      // Byte stores may restore a Uint8Array rather than Electron's required Buffer.
      if (!(value instanceof Uint8Array)) throw new TypeError('Expected encrypted bytes.');
      return safeStorage.decryptString(Buffer.from(value));
    },
  });
}
