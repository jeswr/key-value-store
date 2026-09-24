# @jeswr/key-value-core

Dependency-free asynchronous key-value interfaces and wrappers. Experimental;
not yet published to npm. See the [repository guide](https://github.com/jeswr/key-value-store#contract)
for the full contract and examples.

Exports `KeyValueStore<T>`, `ClearableStore<T>`, `StoredValue`, `Codec<T, Encoded>`,
`ExpiringValue<T>`, `ExpiryOptions`, `withCodec`, `withExpiry`, `withNamespace`,
and adapter validation/namespace helpers.

All stores use `getItem`, `setItem`, `removeItem`. Missing entries return `null`;
failures reject. Top-level `null` and `undefined` cannot be stored. Keys are opaque
strings. The value type belongs to the whole store.

`withCodec` transforms values explicitly and preserves scoped clearing.
`withExpiry` takes a positive `ttlMs`, hides expired values, and preserves clearing;
it never physically deletes on reads. `withNamespace` wraps a shared backing store
and does not expose clearing because it cannot safely clear the whole backing store.
