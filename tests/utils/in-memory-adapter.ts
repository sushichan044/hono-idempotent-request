import type {
  IdempotentRequest,
  IdempotentRequestStorageAdapter,
  StorageKey,
} from "../../src";

/**
 * In-memory implementation of idempotent request cache storage by function.
 *
 * This is a simple implementation that is not suitable for production use.
 * It is only meant to be used for testing purposes.
 */
export const createInMemoryAdapter = (): IdempotentRequestStorageAdapter => {
  const requests = new Map<StorageKey, IdempotentRequest>();

  return {
    save(request) {
      requests.set(request.storageKey, request);
    },

    update(request) {
      requests.set(request.storageKey, request);
    },

    get(storageKey) {
      return requests.get(storageKey) ?? null;
    },
  };
};
