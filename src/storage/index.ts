import type {
  IdempotentRequest,
  IdempotentRequestBase,
  ProcessedIdempotentRequest,
  ProcessingIdempotentRequest,
  UnProcessedIdempotentRequest,
} from "../idempotent-request";
import type { SerializedResponse } from "../serializer";
import type { IdempotentRequestStorageAdapter } from "./adapter";

import { IdempotencyKeyStorageError } from "../error";

interface IdempotentRequestStorage {
  /**
   * Acquire a lock for the request.
   *
   * @param request
   * The request to acquire a lock for.
   * @returns
   * The locked request.
   */
  acquireLock(
    request: UnProcessedIdempotentRequest,
  ): Promise<ProcessingIdempotentRequest>;

  /**
   * Find or create a request.
   *
   * @param request
   * The request to find or create.
   * @returns
   */
  findOrCreate(request: IdempotentRequestBase): Promise<
    | {
        created: false;
        request: IdempotentRequest;
      }
    | {
        created: true;
        request: UnProcessedIdempotentRequest;
      }
  >;

  /**
   * Set the response and unlock the request.
   *
   * This method internally clones the response, So you don't need to clone in caller side.
   *
   * @param request
   * The request to set the response and unlock.
   * @param response
   * The response to set.
   */
  setResponseAndUnlock(
    request: ProcessingIdempotentRequest,
    response: SerializedResponse,
  ): Promise<void>;
}

export const createIdempotentRequestStorage = (
  adapter: IdempotentRequestStorageAdapter,
): IdempotentRequestStorage => {
  return {
    acquireLock: async (request) => {
      try {
        const lockedRequest = {
          ...request,
          lockedAt: new Date(),
        } satisfies ProcessingIdempotentRequest;
        await adapter.update(lockedRequest);

        return lockedRequest;
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

        const nonLockedRequest = {
          ...request,
          lockedAt: null,
          response: null,
        } satisfies UnProcessedIdempotentRequest;
        await adapter.save(nonLockedRequest);

        return {
          created: true,
          request: nonLockedRequest,
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

    setResponseAndUnlock: async (request, response) => {
      try {
        const unlockedRequest = {
          ...request,
          lockedAt: null,
          response,
        } satisfies ProcessedIdempotentRequest;

        await adapter.update(unlockedRequest);
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
};
