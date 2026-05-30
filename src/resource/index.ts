import type { StorageKey } from "../brand";
import { createIdempotencyFingerprint, createStorageKey } from "../brand";
import type { RequestIdentifier } from "../identifier";
import type { Awaitable } from "../utils/types";

/**
 * Resource Specification - defines key validation and request digest generation.
 *
 * @see Section 2.2, 2.3, 2.4 of {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-2}
 */
export interface ResourceSpecification {
  /**
   * Get a fingerprint from the request's payload.
   *
   * @param request Web-standard request object
   * @returns A fingerprint string representing the uniqueness of the request. Returning `null`
   *   means this resource does not use fingerprint to identify requests.
   * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-2.4 Idempotency Fingerprint}
   */
  getFingerprint(request: Request): Awaitable<string | null>;

  /**
   * Get a key for searching the request in the storage. This key should be unique in the storage.
   *
   * If there are no special considerations, just return the value of the `Idempotency-Key` header.
   *
   * Existence of `Idempotency-Key` header is already guaranteed by the middleware.
   *
   * YOU MUST INCLUDE THE VALUE OF THE `Idempotency-Key` HEADER IN THE STORAGE KEY.
   *
   * @param source Object containing idempotencyKey and request
   * @returns A key that is used to retrieve the request from the storage.
   * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-5 Security Considerations}
   */
  getStorageKey(idempotencyKey: string, request: Request): Awaitable<string>;

  /**
   * Check if the idempotency key satisfies the resource-defined specifications.
   *
   * @param idempotencyKey The `Idempotency-Key` header from the request
   * @returns Whether the key satisfies the resource-defined specifications
   * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-2.5.2 Responsibilities - Resource}
   */
  satisfiesKeySpec(idempotencyKey: string): boolean;
}

/**
 * Create Resource from Resource Specification.
 *
 * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07#name-resource}
 */
export function createResource(spec: ResourceSpecification): IdempotentRequestResource {
  return {
    getStorageKey: async (idempotencyKey, request) => {
      const storageKey = await spec.getStorageKey(idempotencyKey, request);
      return createStorageKey(storageKey);
    },

    getRequestIdentifier: async (idempotencyKey, request) => {
      const requestPath = new URL(request.url).pathname;

      const rawFingerprint = await spec.getFingerprint(request);
      const fingerprint =
        rawFingerprint == null ? null : createIdempotencyFingerprint(rawFingerprint);

      return {
        fingerprint,
        idempotencyKey,
        requestMethod: request.method,
        requestPath,
      };
    },

    satisfiesKeySpec: (idempotencyKey) => spec.satisfiesKeySpec(idempotencyKey),
  };
}

/** @internal */
interface IdempotentRequestResource {
  getRequestIdentifier(idempotencyKey: string, request: Request): Promise<RequestIdentifier>;

  getStorageKey(idempotencyKey: string, request: Request): Promise<StorageKey>;

  satisfiesKeySpec(idempotencyKey: string): boolean;
}
