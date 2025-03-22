import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import type { IdempotentRequestServerSpecification } from "./server-specification";
import type { IdempotentRequestStorage } from "./storage";
import type { IdempotencyActivationStrategy } from "./strategy";
import type { NonLockedIdempotentRequest } from "./types";

import {
  IdempotencyKeyConflictError,
  IdempotencyKeyMissingError,
  IdempotencyKeyPayloadMismatchError,
  IdempotencyKeyStorageError,
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

    try {
      const idempotencyKey = c.req.header("Idempotency-Key");
      if (idempotencyKey === undefined) {
        throw new IdempotencyKeyMissingError();
      }

      if (!impl.specification.satisfiesKeySpec(idempotencyKey)) {
        // Omit idempotency processing because the key does not satisfy the server-defined specifications
        return await next();
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
      const storeResult = await impl.storage.findOrCreate({
        ...requestIdentifier,
        storageKey,
      });

      if (!storeResult.created) {
        // Retried request - compare with the stored request
        if (!isIdenticalRequest(storeResult.storedRequest, requestIdentifier)) {
          throw new IdempotencyKeyPayloadMismatchError();
        }

        if (storeResult.storedRequest.lockedAt != null) {
          // The request is locked - still being processed
          throw new IdempotencyKeyConflictError();
        }

        if (storeResult.storedRequest.response) {
          //        ^?
          // Already processed - return the stored response
          return deserializeResponse(storeResult.storedRequest.response);
        }
      }

      // Only for suppressing type error.
      // We can assume that the request is not locked at this point.
      // because we already threw IdempotencyKeyConflictError if { created: false, storedRequest: LockedIdempotentRequest } .
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
    } catch (error) {
      if (error instanceof IdempotencyKeyMissingError) {
        throw new HTTPException(400, {
          message: "Idempotency-Key is missing",
        });
      }
      if (error instanceof IdempotencyKeyConflictError) {
        throw new HTTPException(409, {
          message: "A request is outstanding for this Idempotency-Key",
        });
      }

      if (error instanceof IdempotencyKeyPayloadMismatchError) {
        throw new HTTPException(422, {
          message: "Idempotency-Key is already used",
        });
      }

      throw error;
    }
  });
};
