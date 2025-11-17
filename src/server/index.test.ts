import { beforeEach, describe, expect, it, vi } from "vitest";

import { createIdempotentRequestServer } from "./index";

const stubSpecification = {
  getFingerprint: vi.fn(),
  getStorageKey: vi.fn(),
  satisfiesKeySpec: vi.fn(),
};

describe("createIdempotentRequestServer", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const server = createIdempotentRequestServer(stubSpecification);

  const mockIdempotencyKey = "8a6ead79-2c7c-4c83-a710-84cca2d645cc";
  const mockRequest = new Request("http://localhost/user", {
    body: JSON.stringify({
      name: "John Doe",
    }),
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": mockIdempotencyKey,
    },
    method: "POST",
  });

  describe("getRequestIdentifier", () => {
    it("should return RequestIdentifier with fingerprint when getFingerprint returns a value", async () => {
      stubSpecification.getFingerprint.mockResolvedValue("test-fingerprint");

      const identifier = await server.getRequestIdentifier({
        idempotencyKey: mockIdempotencyKey,
        request: mockRequest,
      });

      expect(identifier).toStrictEqual({
        fingerprint: "test-fingerprint",
        idempotencyKey: mockIdempotencyKey,
        requestMethod: "POST",
        requestPath: "/user",
      });
    });

    it("should return RequestIdentifier with null fingerprint when getFingerprint returns null", async () => {
      stubSpecification.getFingerprint.mockResolvedValue(null);

      const identifier = await server.getRequestIdentifier({
        idempotencyKey: mockIdempotencyKey,
        request: mockRequest,
      });

      expect(identifier).toStrictEqual({
        fingerprint: null,
        idempotencyKey: mockIdempotencyKey,
        requestMethod: "POST",
        requestPath: "/user",
      });
    });
  });

  describe("getStorageKey", () => {
    it("should delegate to spec.getStorageKey", async () => {
      const source = {
        idempotencyKey: mockIdempotencyKey,
        request: mockRequest,
      };
      stubSpecification.getStorageKey.mockResolvedValue("test-storage-key");

      const storageKey = await server.getStorageKey(source);

      expect(stubSpecification.getStorageKey).toHaveBeenCalledWith(source);
      expect(storageKey).toStrictEqual("test-storage-key");
    });
  });

  describe("satisfiesKeySpec", () => {
    it("should delegate to spec.satisfiesKeySpec", () => {
      stubSpecification.satisfiesKeySpec.mockReturnValue(true);

      const result = server.satisfiesKeySpec(mockIdempotencyKey);

      expect(result).toBe(true);
    });
  });
});
