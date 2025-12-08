import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type {
  FulfilledIdempotentRequest,
  ProcessingIdempotentRequest,
  UnProcessedIdempotentRequest,
} from "../idempotent-request";
import type { SerializedResponse } from "../serializer";

import { createStorageKey } from "../brand";
import { IdempotencyKeyStorageError } from "../error";
import { createStorage } from "./index";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
}));

const storageDriver = {
  get: mocks.get,
  save: mocks.save,
  update: mocks.update,
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

  const storage = createStorage(storageDriver);
  const baseRequest: UnProcessedIdempotentRequest = {
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    fingerprint: null,
    idempotencyKey: "cd4e21a0-f506-4ca3-a825-522a28bf7165",
    lockedAt: null,
    requestMethod: "POST",
    requestPath: "/resource/new",
    response: null,
    storageKey: createStorageKey("test-key"),
  };

  describe("lockRequest", () => {
    it("should acquire a lock and update the processing request", async () => {
      const lockedRequest = await storage.lockRequest(baseRequest);

      expect(lockedRequest).toEqual({
        ...baseRequest,
        lockedAt: new Date("2024-01-01T00:01:00.000Z"),
      });
    });

    it("should throw IdempotencyKeyStorageError if adapter.update fails", async () => {
      const adapterError = new Error("Adapter update failed");
      storageDriver.update.mockRejectedValue(adapterError);

      await expect(storage.lockRequest(baseRequest)).rejects.toThrowError(
        IdempotencyKeyStorageError,
      );
      expect(storageDriver.update).toHaveBeenCalledOnce();
    });
  });

  describe("findOrCreate", () => {
    const response: SerializedResponse = {
      body: '{"id": 123}',
      headers: { location: "/resource/123" },
      status: 201,
      statusText: "Created",
    };

    it("should early return with cached request if already processed", async () => {
      const fulfilled: FulfilledIdempotentRequest = {
        ...baseRequest,
        response,
      };
      storageDriver.get.mockResolvedValue(fulfilled);

      const result = await storage.findOrCreate(baseRequest);
      assert.isFalse(result.created);

      expect(result.request).toEqual(fulfilled);
      expect(storageDriver.save).not.toHaveBeenCalled();
    });

    it("should create and save a new unprocessed request if not found", async () => {
      const newRequest: UnProcessedIdempotentRequest = {
        ...baseRequest,
        lockedAt: null,
        response: null,
      };
      storageDriver.get.mockResolvedValue(null);

      const result = await storage.findOrCreate(baseRequest);
      assert.isTrue(result.created);

      expect(result.request).toEqual(newRequest);
    });

    it("should throw IdempotencyKeyStorageError if adapter.get fails", async () => {
      const adapterError = new Error("Adapter get failed");
      storageDriver.get.mockRejectedValue(adapterError);

      await expect(storage.findOrCreate(baseRequest)).rejects.toThrowError(
        IdempotencyKeyStorageError,
      );
    });

    it("should throw IdempotencyKeyStorageError if adapter.save fails", async () => {
      const adapterError = new Error("Adapter save failed");
      storageDriver.save.mockRejectedValue(adapterError);

      await expect(storage.findOrCreate(baseRequest)).rejects.toThrowError(
        IdempotencyKeyStorageError,
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
      headers: { location: "/resource/123" },
      status: 201,
      statusText: "Created",
    };

    it("should set the response, unlock the request, and update", async () => {
      await storage.completeRequestAndUnlock(processingRequest, response);

      expect(storageDriver.update).toHaveBeenCalledExactlyOnceWith({
        ...processingRequest,
        lockedAt: null,
        response,
      });
    });

    it("should throw IdempotencyKeyStorageError if adapter.update fails", async () => {
      const adapterError = new Error("Adapter update failed");
      storageDriver.update.mockRejectedValue(adapterError);

      await expect(
        storage.completeRequestAndUnlock(processingRequest, response),
      ).rejects.toThrowError(IdempotencyKeyStorageError);
      expect(storageDriver.update).toHaveBeenCalledOnce();
    });
  });
});
