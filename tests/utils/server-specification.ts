import { sha256 } from "@oslojs/crypto/sha2";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { version as uuidVersion } from "uuid";

import type { ResourceSpecification } from "../../src";

export const createTestResource = (): ResourceSpecification => {
  return {
    getStorageKey(idempotencyKey, request) {
      const path = new URL(request.url).pathname;

      return `${request.method}-${path}-${idempotencyKey}`;
    },

    async getFingerprint(request) {
      return await generateHash(request);
    },

    satisfiesKeySpec(idempotencyKey) {
      try {
        return uuidVersion(idempotencyKey) === 4;
      } catch {
        return false;
      }
    },
  };
};

/**
 * Hash function - Generate a hash from the request content
 */
const generateHash = async (request: Request): Promise<string> => {
  // For JSON requests, we should ideally sort keys alphabetically before hashing
  // to ensure semantic equivalence regardless of key order.
  // However, in practice, when a client retries a request, the key order typically
  // remains the same, so this simple implementation is sufficient for testing purposes.

  const body = await request.text();

  const digestBase = {
    body,
    method: request.method,
    url: request.url,
  };

  return hashWithSha256(JSON.stringify(digestBase));
};

/**
 * Calculate SHA-256 hash
 */
const hashWithSha256 = (data: string): string => {
  return encodeHexLowerCase(sha256(new TextEncoder().encode(data)));
};
