import type { MiddlewareHandler } from "hono";

import { createMiddleware } from "hono/factory";

import type { Hooks } from "./hooks";
import type {
  ProcessingIdempotentRequest,
  UnProcessedIdempotentRequest,
} from "./idempotent-request";
import type { ResourceSpecification } from "./resource";
import type { FindOrCreateResult } from "./storage";
import type { StorageAdapter } from "./storage/types";
import type { IdempotencyActivationStrategy } from "./strategy";

import { cloneRequest } from "./clone-request";
import {
  IDEMPOTENCY_KEY_CONFLICT_ERROR_RESPONSE,
  IDEMPOTENCY_KEY_MISSING_ERROR_RESPONSE,
  IDEMPOTENCY_KEY_PAYLOAD_MISMATCH_ERROR_RESPONSE,
  REQUEST_UNPROCESSABLE_ERROR_RESPONSE,
} from "./constants/response";
import { IdempotencyKeyStorageError, UnsafeImplementationError } from "./error";
import { resolveHooks } from "./hooks";
import { isIdenticalRequest } from "./identifier";
import { createResource } from "./resource";
import { cloneAndSerializeResponse, deserializeResponse } from "./serializer";
import { createStorage } from "./storage";
import { resolveStrategy } from "./strategy";
import { parseStructuredIdempotencyKey } from "./utils/structured-headers";

export interface IdempotentRequestImplementation {
  /**
   * Strategy for activating idempotency processing
   *
   * As a string:
   * - `"always"`: Always apply idempotency processing (default - compliant with draft-07)
   * - `"opt-in-with-key"`: Apply idempotency processing only if the `Idempotency-Key` header exists
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
   * Resource specification.
   *
   * You must implement this according to your application's requirements.
   */
  resource: ResourceSpecification;

  /**
   * Storage options
   *
   * You should implement features like TTL, cleanup, etc. at this layer.
   */
  storage: {
    /**
     * Storage adapter implementation.
     */
    adapter: StorageAdapter;
  };
}

export function idempotentRequest(
  impl: IdempotentRequestImplementation,
): MiddlewareHandler {
  const strategy = resolveStrategy(impl.activationStrategy ?? "always");
  const hooks = resolveHooks(impl.hooks);
  const resource = createResource(impl.resource);
  const storage = createStorage(impl.storage.adapter);

  return createMiddleware(async (c, next) => {
    const isIdempotencyEnabled = await strategy(await cloneRequest(c));

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
    if (idempotencyKey === null) {
      return await hooks.modifyResponse(
        deserializeResponse(IDEMPOTENCY_KEY_MISSING_ERROR_RESPONSE),
        "key_missing",
      );
    }
    if (!resource.satisfiesKeySpec(idempotencyKey)) {
      return await hooks.modifyResponse(
        deserializeResponse(IDEMPOTENCY_KEY_MISSING_ERROR_RESPONSE),
        "key_missing",
      );
    }

    const storageKey = await resource.getStorageKey(
      idempotencyKey,
      await cloneRequest(c),
    );
    if (!storageKey.includes(idempotencyKey)) {
      throw new UnsafeImplementationError(
        "The storage-key must include the value of the `Idempotency-Key` header.",
      );
    }

    const requestIdentifier = await resource.getRequestIdentifier(
      idempotencyKey,
      await cloneRequest(c),
    );

    let storeResult: FindOrCreateResult;
    try {
      storeResult = await storage.findOrCreate({
        ...requestIdentifier,
        createdAt: new Date(),
        storageKey,
      });
    } catch (error) {
      if (error instanceof IdempotencyKeyStorageError) {
        return await hooks.modifyResponse(
          deserializeResponse(REQUEST_UNPROCESSABLE_ERROR_RESPONSE),
          "storage_error",
        );
      }
      throw error;
    }

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

    let lockedRequest: ProcessingIdempotentRequest;
    try {
      lockedRequest = await storage.lockRequest(unprocessedRequest);
    } catch (error) {
      if (error instanceof IdempotencyKeyStorageError) {
        return await hooks.modifyResponse(
          deserializeResponse(REQUEST_UNPROCESSABLE_ERROR_RESPONSE),
          "storage_error",
        );
      }
      throw error;
    }
    await next();

    const modifiedResponse = await hooks.modifyResponse(
      c.res.clone(),
      "success",
    );
    try {
      // Even if route handler throws an error, this operation will be executed.
      await storage.completeRequestAndUnlock(
        lockedRequest,
        await cloneAndSerializeResponse(modifiedResponse),
      );
    } catch (error) {
      if (error instanceof IdempotencyKeyStorageError) {
        return await hooks.modifyResponse(
          deserializeResponse(REQUEST_UNPROCESSABLE_ERROR_RESPONSE),
          "storage_error",
        );
      }
      throw error;
    }

    return modifiedResponse;
  });
}
