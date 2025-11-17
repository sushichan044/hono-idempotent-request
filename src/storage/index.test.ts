import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ProcessedIdempotentRequest,
  ProcessingIdempotentRequest,
  UnProcessedIdempotentRequest,
} from "../idempotent-request";
import type { SerializedResponse } from "../serializer";

import { createStorageKey } from "../brand";
import { IdempotencyKeyStorageError } from "../error";
import { createIdempotentRequestStorage } from "./index";

const fakeAdapter = {
  get: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
};

describe("createIdempotentRequestStorage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:01:00.000Z")); // Consistent lockedAt
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const storage = createIdempotentRequestStorage(fakeAdapter);

  const baseRequest: UnProcessedIdempotentRequest = {
    fingerprint: null,
    idempotencyKey: "cd4e21a0-f506-4ca3-a825-522a28bf7165",
    lockedAt: null,
    requestMethod: "POST",
    requestPath: "/test",
    response: null,
    storageKey: createStorageKey("test-key"),
  };

  describe("acquireLock", () => {
    it("should acquire a lock and update the processing request", async () => {
      const lockedRequest = await storage.acquireLock(baseRequest);

      expect(lockedRequest).toStrictEqual({
        ...baseRequest,
        lockedAt: new Date("2024-01-01T00:01:00.000Z"),
      });
    });

    it("should throw IdempotencyKeyStorageError if adapter.update fails", async () => {
      const adapterError = new Error("Adapter update failed");
      fakeAdapter.update.mockRejectedValue(adapterError);

      await expect(storage.acquireLock(baseRequest)).rejects.toThrowError(
        new IdempotencyKeyStorageError(
          `Failed to acquire a lock for the stored idempotent request: ${baseRequest.storageKey}`,
          { cause: adapterError },
        ),
      );
      expect(fakeAdapter.update).toHaveBeenCalledOnce();
    });
  });

  describe("findOrCreate", () => {
    const response: SerializedResponse = {
      body: '{"id": 123}',
      headers: { location: "/new-resource" },
      status: 201,
      statusText: "Created",
    };

    it("should early return with cached request if already processed", async () => {
      const existingRequest: ProcessedIdempotentRequest = {
        ...baseRequest,
        response,
      };
      fakeAdapter.get.mockResolvedValue(existingRequest);

      const result = await storage.findOrCreate(baseRequest);

      expect(result).toStrictEqual({
        created: false,
        request: existingRequest,
      });
      expect(fakeAdapter.save).not.toHaveBeenCalled();
    });

    it("should create and save a new unprocessed request if not found", async () => {
      const expectedNewRequest: UnProcessedIdempotentRequest = {
        ...baseRequest,
        lockedAt: null,
        response: null,
      };
      fakeAdapter.get.mockResolvedValue(null);

      const result = await storage.findOrCreate(baseRequest);

      expect(result).toStrictEqual({
        created: true,
        request: expectedNewRequest,
      });
    });

    it("should throw IdempotencyKeyStorageError if adapter.get fails", async () => {
      const adapterError = new Error("Adapter get failed");
      fakeAdapter.get.mockRejectedValue(adapterError);

      await expect(storage.findOrCreate(baseRequest)).rejects.toThrowError(
        new IdempotencyKeyStorageError(
          `Failed to find or create the stored idempotent request: ${baseRequest.storageKey}`,
          { cause: adapterError },
        ),
      );
    });

    it("should throw IdempotencyKeyStorageError if adapter.save fails", async () => {
      const adapterError = new Error("Adapter save failed");
      fakeAdapter.save.mockRejectedValue(adapterError);

      await expect(storage.findOrCreate(baseRequest)).rejects.toThrowError(
        new IdempotencyKeyStorageError(
          `Failed to find or create the stored idempotent request: ${baseRequest.storageKey}`,
          { cause: adapterError },
        ),
      );
    });
  });

  describe("setResponseAndUnlock", () => {
    const processingRequest: ProcessingIdempotentRequest = {
      ...baseRequest,
      lockedAt: new Date("2024-01-01T00:01:00.000Z"),
      response: null,
    };

    const response: SerializedResponse = {
      body: '{"id": 123}',
      headers: { location: "/new-resource" },
      status: 201,
      statusText: "Created",
    };

    it("should set the response, unlock the request, and update", async () => {
      await storage.setResponseAndUnlock(processingRequest, response);

      expect(fakeAdapter.update).toHaveBeenCalledExactlyOnceWith({
        ...processingRequest,
        lockedAt: null,
        response,
      });
    });

    it("should throw IdempotencyKeyStorageError if adapter.update fails", async () => {
      const adapterError = new Error("Adapter update failed");
      fakeAdapter.update.mockRejectedValue(adapterError);

      await expect(
        storage.setResponseAndUnlock(processingRequest, response),
      ).rejects.toThrowError(
        new IdempotencyKeyStorageError(
          `Failed to save the response of an idempotent request: ${processingRequest.storageKey}. You should unlock the request manually.`,
          { cause: adapterError },
        ),
      );
      expect(fakeAdapter.update).toHaveBeenCalledOnce();
    });
  });
});
