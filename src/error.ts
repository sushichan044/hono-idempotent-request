/**
 * If the storage operation fails, this error is thrown.
 *
 * The draft does not provide specific error handling methods, but it must be treated as a negative scenario.
 */
export class IdempotencyKeyStorageError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "IdempotencyKeyStorageError";
  }
}

/**
 * This error is thrown when the implementation is not safe.
 *
 * As this middleware is designed on `Bring-Your-Own-Implementation` pattern,
 * it is possible to use this middleware with unsafe implementation.
 *
 * This error is thrown when unsafe implementation does not satisfy the draft specification.
 */
export class UnsafeImplementationError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "UnsafeImplementationError";
  }
}
