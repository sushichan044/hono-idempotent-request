// Thanks to: https://branded-type-generator.pages.dev

// Idempotency Fingerprint

const IdempotencyFingerprintBrand = Symbol();

export type IdempotencyFingerprint = string & {
  [IdempotencyFingerprintBrand]: unknown;
};

export function createIdempotencyFingerprint(
  p: string,
): IdempotencyFingerprint {
  return p as IdempotencyFingerprint;
}

// Storage Key

const StorageKeyBrand = Symbol();

export type StorageKey = string & {
  [StorageKeyBrand]: unknown;
};

export function createStorageKey(p: string): StorageKey {
  return p as StorageKey;
}
