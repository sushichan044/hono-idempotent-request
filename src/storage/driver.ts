import type { StorageKey } from "../brand";
import type {
  IdempotentRequest,
  ProcessedIdempotentRequest,
  ProcessingIdempotentRequest,
  UnProcessedIdempotentRequest,
} from "../idempotent-request";
import type { MaybePromise } from "../utils/types";

/**
 * Adapter for storage of idempotent request records.
 *
 * You need to implement read/write process with specific persistence services.
 *
 * You can implement persistence policies like TTL at this layer.
 */
export interface IdempotentRequestStorageAdapter {
  /**
   * Get a stored request.
   *
   * @param storageKey
   * The storage key of the request.
   * @returns
   * Stored request or `null` if the request is not found.
   */
  get(storageKey: StorageKey): MaybePromise<IdempotentRequest | null>;

  /**
   * Save a new unprocessed request.
   *
   * @param request
   * The request to save.
   */
  save(request: UnProcessedIdempotentRequest): MaybePromise<void>;

  /**
   * Update a request.
   *
   * @param request
   * The request to update.
   */
  update(
    request: ProcessedIdempotentRequest | ProcessingIdempotentRequest,
  ): MaybePromise<void>;
}
