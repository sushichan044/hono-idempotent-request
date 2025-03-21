import type { IdempotencyFingerprint, IdempotentStorageKey } from "./brand";
import type { SerializedResponse } from "./utils/response";

type IdempotentRequestBase = {
  /**
   * Storage key
   *
   * This is used to retrieve the request from the storage.
   */
  storageKey: IdempotentStorageKey;

  /**
   * Request fingerprint
   *
   * This is used to identify the request in the storage.
   */
  fingerprint: IdempotencyFingerprint | null;

  /** Stored response
   * (null until server completes processing request)
   */
  response: SerializedResponse | null;
};

export type StoredIdempotentRequest =
  | LockedIdempotentRequest
  | NonLockedIdempotentRequest;

export type NonLockedIdempotentRequest = IdempotentRequestBase & {
  /**
   * Time when the request was locked for processing
   *
   * This is used to prevent race conditions when multiple requests are
   * trying to process the same request concurrently.
   */
  lockedAt: null;
};

export type LockedIdempotentRequest = IdempotentRequestBase & {
  /**
   * Time when the request was locked for processing
   *
   * This is used to prevent race conditions when multiple requests are
   * trying to process the same request concurrently.
   */
  lockedAt: Date;
};
