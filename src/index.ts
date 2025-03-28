import { createMiddleware } from "hono/factory";

import type { IdempotentRequestServerSpecification } from "./server-specification";
import type { IdempotentRequestStorage } from "./storage";
import type { IdempotencyActivationStrategy } from "./strategy";
import type { NonLockedIdempotentRequest } from "./types";

import {
  createIdempotencyKeyConflictErrorResponse,
  createIdempotencyKeyMissingErrorResponse,
  createIdempotencyKeyPayloadMismatchErrorResponse,
  IdempotencyKeyStorageError,
  UnsafeImplementationError,
} from "./error";
import { createRequestIdentifier, isIdenticalRequest } from "./identifier";
import { prepareActivationStrategy } from "./strategy";
import {
  cloneAndSerializeResponse,
  deserializeResponse,
} from "./utils/response";

export interface IdempotentRequestImplementation {
  /**
   * Strategy for activating idempotency processing
   *
   * As a string:
   * - `"always"`: Always apply idempotency processing
   * - `"opt-in"`: Apply idempotency processing only if the Idempotency-Key header exists
   *
   * As a function:
   * - A function that determines whether to apply idempotency processing using custom logic
   *   - Useful when you are using strategies like feature flags
   *   - Return `true` to apply idempotency processing, `false` otherwise
   *
   * @default "always"
   */
  activationStrategy?: IdempotencyActivationStrategy;

  /**
   * Server specification
   */
  specification: IdempotentRequestServerSpecification;

  /**
   * Storage implementation
   *
   * You should implement features like TTL, cleanup, etc. at this layer.
   */
  storage: IdempotentRequestStorage;
}

/**
 * Create a Hono middleware for handling idempotent requests
 * @param impl - Injectable implementation
 */
export const idempotentRequest = (impl: IdempotentRequestImplementation) => {
  const idempotencyStrategyFunction = prepareActivationStrategy(
    impl.activationStrategy,
  );

  return createMiddleware(async (c, next) => {
    const isIdempotencyEnabled = await idempotencyStrategyFunction(
      c.req.raw.clone(),
    );

    if (!isIdempotencyEnabled) {
      return await next();
    }

    const idempotencyKey = c.req.header("Idempotency-Key");
    if (
      idempotencyKey === undefined ||
      !impl.specification.satisfiesKeySpec(idempotencyKey)
    ) {
      return createIdempotencyKeyMissingErrorResponse();
    }

    const requestIdentifier = await createRequestIdentifier(
      impl.specification,
      {
        idempotencyKey,
        request: c.req.raw.clone(),
      },
    );
    const storageKey = await impl.specification.getStorageKey(
      c.req.raw.clone(),
    );
    if (!storageKey.includes(idempotencyKey)) {
      throw new UnsafeImplementationError(
        "The storage-key must include the value of the `Idempotency-Key` header.",
      );
    }

    const storeResult = await (async () => {
      try {
        return impl.storage.findOrCreate({
          ...requestIdentifier,
          storageKey,
        });
      } catch (error) {
        throw new IdempotencyKeyStorageError(
          "Failed to find or create the stored idempotent request",
          {
            cause: error,
          },
        );
      }
    })();

    if (!storeResult.created) {
      // Retried request - compare with the stored request
      if (!isIdenticalRequest(storeResult.storedRequest, requestIdentifier)) {
        return createIdempotencyKeyPayloadMismatchErrorResponse();
      }

      if (storeResult.storedRequest.lockedAt != null) {
        // The request is locked - still being processed, or processing succeeded but the response failed to be recorded.
        return createIdempotencyKeyConflictErrorResponse();
      }

      if (storeResult.storedRequest.response) {
        //              ^?
        // TIP: ^? above is called `Two slash query` in TypeScript. see: https://www.typescriptlang.org/dev/twoslash
        // Already processed - return the stored response
        return deserializeResponse(storeResult.storedRequest.response);
      }

      // If you reach this point, the previous request simply failed to acquire a lock.
      // So just continue to re-try lock and process the request.
    }

    // Only for suppressing type error.
    // We can assume that the request is not locked at this point.
    // because we already called createIdempotencyKeyConflictErrorResponse()
    // if situation like { created: false, storedRequest: LockedIdempotentRequest }
    const nonLockedRequest =
      storeResult.storedRequest as NonLockedIdempotentRequest;

    const lockedRequest = await (async () => {
      try {
        return impl.storage.lock(nonLockedRequest);
      } catch (error) {
        throw new IdempotencyKeyStorageError(
          "Failed to lock the stored idempotent request",
          {
            cause: error,
          },
        );
      }
    })();

    // Execute hono route handler
    await next();

    // Even if route handler throws an error, this operation will be executed.
    try {
      await impl.storage.setResponseAndUnlock(
        lockedRequest,
        await cloneAndSerializeResponse(c.res),
      );
    } catch (error) {
      throw new IdempotencyKeyStorageError(
        "Failed to save the response of an idempotent request. You should unlock the request manually.",
        {
          cause: error,
        },
      );
    }
  });
};
