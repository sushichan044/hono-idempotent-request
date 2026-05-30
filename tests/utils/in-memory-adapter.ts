import type { IdempotentRequest, StorageAdapter } from "../../src";

const TTL_ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * In-memory implementation of idempotent request cache storage by function.
 *
 * This is a simple implementation that is not suitable for production use. It is only meant to be
 * used for testing purposes.
 */
export const createInMemoryAdapter = (): StorageAdapter => {
  const requests = new Map<string, IdempotentRequest>();

  return {
    save(request) {
      requests.set(request.storageKey, request);
    },

    update(request) {
      requests.set(request.storageKey, request);
    },

    get(storageKey) {
      const got = requests.get(storageKey);
      if (!got) {
        return null;
      }

      const now = Date.now();
      if (now - got.createdAt.getTime() > TTL_ONE_WEEK) {
        requests.delete(storageKey);
        return null;
      }

      return got;
    },
  };
};
