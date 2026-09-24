# @jeswr/key-value-vscode

An adapter around an extension's existing `context.secrets`.
Experimental; not yet published to npm.

```ts
import type { ExtensionContext } from 'vscode';
import { createVSCodeSecretStore } from '@jeswr/key-value-vscode';

export async function activate(context: ExtensionContext) {
  const secrets = createVSCodeSecretStore(context.secrets, {
    namespace: 'my-extension:credentials:v1',
  });
  await secrets.setItem('refresh-token', 'secret');
  const token = await secrets.getItem('refresh-token'); // string | null
  await secrets.removeItem('refresh-token');
}
```

The package takes a structural `VSCodeSecretStorage` interface, accepting VS Code
Thenables as well as native promises. It does not import the `vscode` runtime and
can be bundled for desktop or web extension hosts. Pass the extension's own
SecretStorage rather than `globalState` or `workspaceState` for secrets.

Values are strings; use an explicit codec for structured data. Missing values
become `null`, writes await the host operation, and host failures reject unchanged.
Keys retain their exact contents under a collision-free namespace prefix. Multiple
instances with the same namespace and host share entries. No enumeration,
subscriptions or `clear()` are exposed; the adapter only requires the host's
`get`, `store` and `delete` methods.

Protection, availability and persistence are delegated to the VS Code host; the
adapter cannot inspect or strengthen the host's chosen secret backend. It does
not add a fallback or cross-machine synchronization.

Tests use injected hosts, including Thenables, and check compatibility with the
published VS Code declarations. They do not launch an extension host or write
personal credentials. See the [VS Code SecretStorage API](https://code.visualstudio.com/api/references/vscode-api#SecretStorage).
