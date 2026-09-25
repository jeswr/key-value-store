// Compile-time checks against the host projects' published declarations.
import type { ExtensionContext } from 'vscode';
import type { SafeStorage } from 'electron';
import type { KeyValueStore } from '@key-value-kit/core';
import { createVSCodeSecretStore } from '@key-value-kit/vscode';
import { createElectronSecretStore } from '@key-value-kit/electron';

export function vscodeCompatibility(context: ExtensionContext): KeyValueStore<string> {
  return createVSCodeSecretStore(context.secrets, { namespace: 'example' });
}

export function electronCompatibility(safeStorage: SafeStorage, bytes: KeyValueStore<Uint8Array>): KeyValueStore<string> {
  return createElectronSecretStore(safeStorage, bytes, { namespace: 'example' });
}
