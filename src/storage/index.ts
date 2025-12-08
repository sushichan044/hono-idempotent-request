import type {
  FulfilledIdempotentRequest,
  IdempotentRequest,
  IdempotentRequestBase,
  ProcessingIdempotentRequest,
  UnProcessedIdempotentRequest,
} from "../idempotent-request";
import type { SerializedResponse } from "../serializer";
import type { StorageAdapter } from "./types";

import { IdempotencyKeyStorageError } from "../error";

export type FindOrCreateResult =
  | {
      created: false;
      request: IdempotentRequest;
    }
  | {
      created: true;
      request: UnProcessedIdempotentRequest;
    };

interface IdempotentRequestStorage {
  /**
   * Complete the request by setting the response and freeing the lock.
   *
   * This method internally clones the response, So you don't need to clone in caller side.
   *
   * @param request
   * The request to set the response and unlock.
   * @param response
   * The response to set.
   */
  completeRequestAndUnlock(
    request: ProcessingIdempotentRequest,
    response: SerializedResponse,
  ): Promise<void>;

  /**
   * Find or create a request.
   *
   * @param request
   * The request to find or create.
   * @returns
   *
   * - If the request is found, returns `{ created: false, request: IdempotentRequest }`.
   * - If the request is not found, persists a new unprocessed request and returns `{ created: true, request: UnProcessedIdempotentRequest }`.
   */
  findOrCreate(request: IdempotentRequestBase): Promise<FindOrCreateResult>;

  /**
   * Acquire a lock for the request.
   *
   * @param request
   * The request to acquire a lock for.
   * @returns
   * The locked request.
   */
  lockRequest(
    request: UnProcessedIdempotentRequest,
  ): Promise<ProcessingIdempotentRequest>;
}

/**
 * @internal
 */
export function createStorage(
  adapter: StorageAdapter,
): IdempotentRequestStorage {
  return {
    lockRequest: async (request) => {
      try {
        const locked: ProcessingIdempotentRequest = {
          ...request,
          lockedAt: new Date(),
        };
        await adapter.update(locked);

        return locked;
      } catch (error) {
        throw new IdempotencyKeyStorageError(
          `Failed to acquire a lock for the stored idempotent request: ${request.storageKey}`,
          {
            cause: error,
          },
        );
      }
    },

    findOrCreate: async (request) => {
      try {
        const storedRequest = await adapter.get(request.storageKey);
        if (storedRequest) {
          return {
            created: false,
            request: storedRequest,
          };
        }

        const pendingRequest: UnProcessedIdempotentRequest = {
          ...request,
          lockedAt: null,
          response: null,
        };
        await adapter.save(pendingRequest);

        return {
          created: true,
          request: pendingRequest,
        };
      } catch (error) {
        throw new IdempotencyKeyStorageError(
          `Failed to find or create the stored idempotent request: ${request.storageKey}`,
          {
            cause: error,
          },
        );
      }
    },

    completeRequestAndUnlock: async (request, response) => {
      try {
        const fulfilledRequest: FulfilledIdempotentRequest = {
          ...request,
          lockedAt: null,
          response,
        };

        await adapter.update(fulfilledRequest);
      } catch (error) {
        throw new IdempotencyKeyStorageError(
          `Failed to save the response of an idempotent request: ${request.storageKey}. You should unlock the request manually.`,
          {
            cause: error,
          },
        );
      }
    },
  };
}
