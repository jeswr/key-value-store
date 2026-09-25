# Alpha releases

The GitHub repository is `jeswr/KeyValueKit` and the npm scope is
`@key-value-kit`. Ensure the publishing account is an owner or authorized
publisher of the npm organization before releasing.

## Validate and pack

```sh
npm ci
npm run check
npm run test:browser
npm run test:bun
npm run test:deno
npm pack --workspaces --dry-run
```

Set `ELECTRON_SKIP_BINARY_DOWNLOAD=1` when installing if the Electron runtime is
not needed; its development dependency supplies official declarations for tests.
Every package must have the same alpha version, and adapters must pin that exact
version of `@key-value-kit/core`. The manifest publish configuration specifies
public access, the npm registry and the `alpha` tag.

## Publish

Authenticate with `npm login --auth-type=web --registry=https://registry.npmjs.org/`
and verify the account using `npm whoami`. Publish the core first, then adapters:

```sh
npm publish --workspace @key-value-kit/core --access public --tag alpha
npm publish --workspace @key-value-kit/storage --access public --tag alpha
npm publish --workspace @key-value-kit/bun --access public --tag alpha
npm publish --workspace @key-value-kit/node --access public --tag alpha
npm publish --workspace @key-value-kit/deno --access public --tag alpha
npm publish --workspace @key-value-kit/vscode --access public --tag alpha
npm publish --workspace @key-value-kit/electron --access public --tag alpha
```

Do not change 2FA settings to bypass a publish challenge. Complete npm's normal
authentication flow. If a publish result is uncertain, query that exact version
and its integrity before retrying: a published name/version cannot be overwritten.

## Verify and announce

For each package, inspect `npm view @key-value-kit/<package>@0.1.0-alpha.0`
and `npm dist-tag ls @key-value-kit/<package>`. Confirm `alpha` identifies the
release. On the first publication, npm also assigns `latest` even when publishing
with `--tag alpha`; removal was rejected with HTTP 400 for this release. See
[npm/cli#8490](https://github.com/npm/cli/issues/8490). Document the actual tags
in the release notes and recommend explicit `@alpha` installs. For subsequent
alpha releases, verify that `latest` has not moved to the new version.

Install the seven exact registry versions in a clean consumer directory and run
import and TypeScript checks.
Only then tag the matching source revision `v0.1.0-alpha.0` and create a GitHub
prerelease. Do not announce publication until the registry checks succeed.

## Compatibility with the unpublished prototype

The npm import paths change, but existing storage namespace prefixes retain the
prototype's internal `@jeswr/key-value:` encoding. Those prefixes are data-format
identifiers, not npm imports. Keeping them avoids making existing prototype data
inaccessible. Repository URLs and copyright attribution also remain unchanged.
