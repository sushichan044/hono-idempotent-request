import type { StorageKey } from "../brand";
import type { RequestIdentifier } from "../identifier";
import type { IdempotentRequestServerSpecification } from "./specification";

import { createIdempotencyFingerprint, createStorageKey } from "../brand";

export interface IdempotentRequestServer {
  getRequestIdentifier(source: {
    idempotencyKey: string;
    request: Request;
  }): Promise<RequestIdentifier>;

  getStorageKey(source: {
    idempotencyKey: string;
    request: Request;
  }): Promise<StorageKey>;

  satisfiesKeySpec(idempotencyKey: string): boolean;
}

export const createIdempotentRequestServer = (
  spec: IdempotentRequestServerSpecification,
): IdempotentRequestServer => {
  return {
    async getStorageKey(source) {
      const storageKey = await spec.getStorageKey(source);
      return createStorageKey(storageKey);
    },

    async getRequestIdentifier({ idempotencyKey, request }) {
      const requestPath = new URL(request.url).pathname;

      const rawFingerprint = await spec.getFingerprint(request);
      const fingerprint =
        rawFingerprint == null
          ? null
          : createIdempotencyFingerprint(rawFingerprint);

      return {
        fingerprint,
        idempotencyKey,
        requestMethod: request.method,
        requestPath,
      };
    },

    satisfiesKeySpec(idempotencyKey) {
      return spec.satisfiesKeySpec(idempotencyKey);
    },
  };
};
