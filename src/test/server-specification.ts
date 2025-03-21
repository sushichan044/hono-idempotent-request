import { sha256 } from "@oslojs/crypto/sha2";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { version as uuidVersion } from "uuid";

import type { IdempotentRequestServerSpecification } from "../server-specification/index";

import {
  createIdempotencyFingerprint,
  createIdempotentStorageKey,
  type IdempotencyFingerprint,
  type IdempotentStorageKey,
} from "../brand";

/**
 * Idempotent request server specification for testing purposes.
 *
 * This is a simple implementation that is not suitable for production use.
 * It is only meant to be used for testing purposes.
 *
 * - Idempotency-Key format: `uuidv4`
 */
export const createTestServerSpecification =
  (): IdempotentRequestServerSpecification => {
    return {
      getStorageKey(request: Request): IdempotentStorageKey {
        const path = new URL(request.url).pathname;
        const idempotencyKey = request.headers.get("Idempotency-Key");

        return createIdempotentStorageKey(
          `${request.method}-${path}-${idempotencyKey}`,
        );
      },

      async getFingerprint(request: Request): Promise<IdempotencyFingerprint> {
        return createIdempotencyFingerprint(await generateHash(request));
      },

      satisfiesKeySpec(idempotencyKey: string): boolean {
        return uuidVersion(idempotencyKey) === 4;
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
    headers: Object.fromEntries(request.headers.entries()),
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
