import type { MiddlewareHandler } from "hono";

import { createMiddleware } from "hono/factory";

import type { Hooks } from "./hooks";
import type { UnProcessedIdempotentRequest } from "./idempotent-request";
import type { IdempotentRequestServerSpecification } from "./server/specification";
import type { IdempotentRequestStorageAdapter } from "./storage/adapter";
import type { IdempotencyActivationStrategy } from "./strategy";

import { cloneRequest } from "./clone-request";
import {
  IDEMPOTENCY_KEY_CONFLICT_ERROR_RESPONSE,
  IDEMPOTENCY_KEY_MISSING_ERROR_RESPONSE,
  IDEMPOTENCY_KEY_PAYLOAD_MISMATCH_ERROR_RESPONSE,
} from "./constants/response";
import { UnsafeImplementationError } from "./error";
import { resolveHooks } from "./hooks";
import { isIdenticalRequest } from "./identifier";
import { cloneAndSerializeResponse, deserializeResponse } from "./serializer";
import { createIdempotentRequestServer } from "./server";
import { createIdempotentRequestStorage } from "./storage";
import { prepareActivationStrategy } from "./strategy";
import { parseStructuredIdempotencyKey } from "./utils/structured-headers";

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
   *   - YOU MUST CHECK EXISTENCE OF `Idempotency-Key` HEADER.
   *   - Useful when you are using strategies like feature flags
   *   - Return `true` to apply idempotency processing, `false` otherwise
   *
   * @default "always"
   *
   * @example
   * ```ts
   * (req) => {
   *    return (
   *     typeof req.headers.get("Idempotency-Key") === "string" &&
   *     req.headers.get("X-Enable-Idempotency") === "true"
   *   );
   * };
   */
  activationStrategy?: IdempotencyActivationStrategy;

  hooks?: Partial<Hooks>;

  /**
   * Server options
   */
  server: {
    /**
     * Server specification
     */
    specification: IdempotentRequestServerSpecification;
  };

  /**
   * Storage options
   *
   * You should implement features like TTL, cleanup, etc. at this layer.
   */
  storage: {
    /**
     * Storage adapter implementation.
     */
    adapter: IdempotentRequestStorageAdapter;
  };
}

export function idempotentRequest(
  impl: IdempotentRequestImplementation,
): MiddlewareHandler {
  const idempotencyStrategyFunction = prepareActivationStrategy(
    impl.activationStrategy ?? "always",
  );
  const hooks = resolveHooks(impl.hooks);
  const server = createIdempotentRequestServer(impl.server.specification);
  const storage = createIdempotentRequestStorage(impl.storage.adapter);

  return createMiddleware(async (c, next) => {
    const isIdempotencyEnabled = await idempotencyStrategyFunction(
      await cloneRequest(c),
    );

    if (!isIdempotencyEnabled) {
      return await next();
    }

    const rawIdempotencyKey = c.req.header("Idempotency-Key");
    // nullish / empty is treated as missing key
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (!rawIdempotencyKey) {
      return await hooks.modifyResponse(
        deserializeResponse(IDEMPOTENCY_KEY_MISSING_ERROR_RESPONSE),
        "key_missing",
      );
    }
    const idempotencyKey = parseStructuredIdempotencyKey(rawIdempotencyKey);
    if (!server.satisfiesKeySpec(idempotencyKey)) {
      return await hooks.modifyResponse(
        deserializeResponse(IDEMPOTENCY_KEY_MISSING_ERROR_RESPONSE),
        "key_missing",
      );
    }

    const storageKey = await server.getStorageKey({
      idempotencyKey,
      request: await cloneRequest(c),
    });
    if (!storageKey.includes(idempotencyKey)) {
      throw new UnsafeImplementationError(
        "The storage-key must include the value of the `Idempotency-Key` header.",
      );
    }

    const requestIdentifier = await server.getRequestIdentifier({
      idempotencyKey,
      request: await cloneRequest(c),
    });

    const storeResult = await storage.findOrCreate({
      ...requestIdentifier,
      storageKey,
    });

    let unprocessedRequest: UnProcessedIdempotentRequest;
    if (storeResult.created) {
      unprocessedRequest = storeResult.request;
    } else {
      // Retried request - compare with the stored request
      if (!isIdenticalRequest(storeResult.request, requestIdentifier)) {
        return await hooks.modifyResponse(
          deserializeResponse(IDEMPOTENCY_KEY_PAYLOAD_MISMATCH_ERROR_RESPONSE),
          "key_payload_mismatch",
        );
      }

      if (storeResult.request.lockedAt != null) {
        return await hooks.modifyResponse(
          deserializeResponse(IDEMPOTENCY_KEY_CONFLICT_ERROR_RESPONSE),
          "key_conflict",
        );
      }

      if (storeResult.request.response) {
        return await hooks.modifyResponse(
          deserializeResponse(storeResult.request.response),
          "retrieved_stored_response",
        );
      }

      // If we reach this point, the previous request failed to acquire a lock.
      // So just continue to re-try lock and process the request.
      unprocessedRequest = storeResult.request;
    }

    const lockedRequest = await storage.acquireLock(unprocessedRequest);
    await next();

    const modifiedResponse = await hooks.modifyResponse(
      c.res.clone(),
      "success",
    );
    // Even if route handler throws an error, this operation will be executed.
    await storage.setResponseAndUnlock(
      lockedRequest,
      await cloneAndSerializeResponse(modifiedResponse),
    );

    return modifiedResponse;
  });
}
