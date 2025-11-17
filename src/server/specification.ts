import type { Awaitable } from "../utils/types";

/**
 * Parameter object for getStorageKey method.
 */
interface GetStorageKeySource {
  /**
   * The `Idempotency-Key` header from the request
   */
  idempotencyKey: string;
  /**
   * Web-standard request object
   */
  request: Request;
}

/**
 * Specification - defines key validation and request digest generation.
 *
 * @see Section 2.2, 2.3, 2.4 of {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-2}
 */
export interface IdempotentRequestServerSpecification {
  /**
   * Get a fingerprint from the request's payload.
   *
   * Just return `null` if you don't use fingerprint for identifying the request.
   *
   * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-2.4 Idempotency Fingerprint}
   *
   * @param request
   * Web-standard request object
   * @returns
   * A fingerprint string representing the uniqueness of the request.
   * Returning `null` means this server specification does not use fingerprint.
   */
  getFingerprint(request: Request): Awaitable<string | null>;

  /**
   * Get a key for searching the request in the storage.
   * This key should be unique in the storage.
   *
   * If there are no special considerations, just return the value of the `Idempotency-Key` header.
   *
   * Existence of `Idempotency-Key` header is already guaranteed by the middleware.
   *
   * YOU MUST INCLUDE THE VALUE OF THE `Idempotency-Key` HEADER IN THE STORAGE KEY.
   *
   * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-5 Security Considerations}
   *
   * @param source
   * Object containing idempotencyKey and request
   * @returns
   * A key that is used to retrieve the request from the storage.
   */
  getStorageKey(source: GetStorageKeySource): Awaitable<string>;

  /**
   * Check if the idempotency key satisfies the server-defined specifications
   *
   * If the key does not satisfy the specifications, the request will be processed without idempotency.
   *
   * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-2.5.2 Responsibilities - Resource}
   *
   * @param idempotencyKey
   * The `Idempotency-Key` header from the request
   * @returns
   * Whether the key satisfies the server-defined specifications
   */
  satisfiesKeySpec(idempotencyKey: string): boolean;
}
