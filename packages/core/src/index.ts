/** Top-level null and undefined are reserved for absence. */
export type StoredValue = NonNullable<unknown>;

export interface KeyValueStore<T extends StoredValue> {
  getItem(key: string): Promise<T | null>;
  setItem(key: string, value: T): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface ClearableStore<T extends StoredValue> extends KeyValueStore<T> {
  /** Remove only the entries owned by this store. */
  clear(): Promise<void>;
}

export interface Codec<T, Encoded> {
  encode(value: T): Encoded;
  decode(value: Encoded): T;
}

export function assertStoredValue(value: unknown): asserts value is StoredValue {
  if (value === null || value === undefined) {
    throw new TypeError('Top-level null and undefined are reserved for missing entries.');
  }
}

export function assertKey(key: unknown): asserts key is string {
  if (typeof key !== 'string') throw new TypeError('Keys must be strings.');
}

export function assertStringValue(value: unknown): asserts value is string {
  if (typeof value !== 'string') throw new TypeError('This store accepts string values only. Use an explicit codec for other values.');
}

/** A delimited, collision-free prefix; keys remain opaque and case-sensitive. */
export function namespacePrefix(namespace: string): string {
  if (typeof namespace !== 'string' || namespace.length === 0) {
    throw new TypeError('A non-empty namespace is required.');
  }
  return `@jeswr/key-value:${JSON.stringify(namespace)}:`;
}

/** Does not expose clear(): the backing store may contain other namespaces. */
export function withNamespace<T extends StoredValue>(
  store: KeyValueStore<T>, namespace: string,
): KeyValueStore<T> {
  const prefix = namespacePrefix(namespace);
  const scopedKey = (key: string): string => { assertKey(key); return prefix + key; };
  return {
    async getItem(key) { return store.getItem(scopedKey(key)); },
    async setItem(key, value) { assertStoredValue(value); await store.setItem(scopedKey(key), value); },
    async removeItem(key) { await store.removeItem(scopedKey(key)); },
  };
}

function preserveClear<T extends StoredValue>(
  source: object, target: KeyValueStore<T>,
): KeyValueStore<T> | ClearableStore<T> {
  if ('clear' in source && typeof source.clear === 'function') {
    const clear = source.clear.bind(source) as () => Promise<void>;
    return { ...target, async clear() { await clear(); } };
  }
  return target;
}

export function withCodec<T extends StoredValue, E extends StoredValue>(store: ClearableStore<E>, codec: Codec<T, E>): ClearableStore<T>;
export function withCodec<T extends StoredValue, E extends StoredValue>(store: KeyValueStore<E>, codec: Codec<T, E>): KeyValueStore<T>;
export function withCodec<T extends StoredValue, E extends StoredValue>(
  store: KeyValueStore<E>, codec: Codec<T, E>,
): KeyValueStore<T> | ClearableStore<T> {
  return preserveClear(store, {
    async getItem(key) {
      assertKey(key);
      const encoded = await store.getItem(key);
      if (encoded === null) return null;
      const value = codec.decode(encoded);
      assertStoredValue(value);
      return value;
    },
    async setItem(key, value) {
      assertKey(key);
      assertStoredValue(value);
      const encoded = codec.encode(value);
      assertStoredValue(encoded);
      await store.setItem(key, encoded);
    },
    async removeItem(key) { assertKey(key); await store.removeItem(key); },
  });
}

export interface ExpiringValue<T extends StoredValue> {
  value: T;
  /** Unix epoch milliseconds. */
  expiresAt: number;
}

export interface ExpiryOptions {
  /** A positive, finite lifetime measured from each setItem call. */
  ttlMs: number;
  /** Override for deterministic tests. Must return Unix epoch milliseconds. */
  now?: () => number;
}

export function withExpiry<T extends StoredValue>(store: ClearableStore<ExpiringValue<T>>, options: ExpiryOptions): ClearableStore<T>;
export function withExpiry<T extends StoredValue>(store: KeyValueStore<ExpiringValue<T>>, options: ExpiryOptions): KeyValueStore<T>;
export function withExpiry<T extends StoredValue>(
  store: KeyValueStore<ExpiringValue<T>>, { ttlMs, now = Date.now }: ExpiryOptions,
): KeyValueStore<T> | ClearableStore<T> {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new RangeError('ttlMs must be positive and finite.');
  return preserveClear(store, {
    async getItem(key) {
      assertKey(key);
      const entry = await store.getItem(key);
      if (entry === null) return null;
      if (!Number.isFinite(entry.expiresAt)) throw new TypeError('Invalid expiry timestamp.');
      assertStoredValue(entry.value);
      // Do not delete here: a concurrent writer may already have replaced this entry.
      return now() >= entry.expiresAt ? null : entry.value;
    },
    async setItem(key, value) {
      assertKey(key);
      assertStoredValue(value);
      const expiresAt = now() + ttlMs;
      if (!Number.isFinite(expiresAt)) throw new RangeError('Invalid expiry timestamp.');
      await store.setItem(key, { value, expiresAt });
    },
    async removeItem(key) { assertKey(key); await store.removeItem(key); },
  });
}
