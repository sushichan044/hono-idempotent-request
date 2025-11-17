import type { StorageKey } from "./brand";
import type { RequestIdentifier } from "./identifier";
import type { SerializedResponse } from "./serializer";

export type IdempotentRequestBase = Readonly<
  RequestIdentifier & {
    /**
     * Storage key
     *
     * This is used to retrieve the request from the storage.
     */
    storageKey: StorageKey;
  }
>;

export type IdempotentRequest =
  | ProcessedIdempotentRequest
  | ProcessingIdempotentRequest
  | UnProcessedIdempotentRequest;

export type UnProcessedIdempotentRequest = IdempotentRequestBase &
  Readonly<{
    /**
     * Time when the request was locked for processing
     *
     * This is used to prevent race conditions when multiple requests are
     * trying to process the same request concurrently.
     */
    lockedAt: null;

    response: null;
  }>;

export type ProcessingIdempotentRequest = IdempotentRequestBase &
  Readonly<{
    /**
     * Time when the request was locked for processing
     *
     * This is used to prevent race conditions when multiple requests are
     * trying to process the same request concurrently.
     */
    lockedAt: Date;

    response: null;
  }>;

export type ProcessedIdempotentRequest = IdempotentRequestBase &
  Readonly<{
    /**
     * Time when the request was locked for processing
     *
     * This is used to prevent race conditions when multiple requests are
     * trying to process the same request concurrently.
     */
    lockedAt: null;

    response: SerializedResponse;
  }>;
