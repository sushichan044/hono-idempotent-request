import { beforeEach, describe, expect, it, vi } from "vitest";

import { createResource } from "./index";

const stubSpecification = {
  getFingerprint: vi.fn(),
  getStorageKey: vi.fn(),
  satisfiesKeySpec: vi.fn(),
};

describe("IdempotentRequestResource", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const resource = createResource(stubSpecification);

  const idempotencyKey = "8a6ead79-2c7c-4c83-a710-84cca2d645cc";
  const request = new Request("http://localhost/user", {
    body: JSON.stringify({
      name: "John Doe",
    }),
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    method: "POST",
  });

  describe("getRequestIdentifier", () => {
    it("should return RequestIdentifier with fingerprint when getFingerprint returns a value", async () => {
      stubSpecification.getFingerprint.mockResolvedValue("test-fingerprint");

      const identifier = await resource.getRequestIdentifier({
        idempotencyKey,
        request,
      });

      expect(identifier).toEqual({
        fingerprint: "test-fingerprint",
        idempotencyKey,
        requestMethod: "POST",
        requestPath: "/user",
      });
    });

    it("should return RequestIdentifier with null fingerprint when getFingerprint returns null", async () => {
      stubSpecification.getFingerprint.mockResolvedValue(null);

      const identifier = await resource.getRequestIdentifier({
        idempotencyKey,
        request,
      });

      expect(identifier).toStrictEqual({
        fingerprint: null,
        idempotencyKey,
        requestMethod: "POST",
        requestPath: "/user",
      });
    });
  });

  describe("getStorageKey", () => {
    it("should delegate to spec.getStorageKey", async () => {
      const source = {
        idempotencyKey,
        request,
      };
      stubSpecification.getStorageKey.mockResolvedValue("test-storage-key");

      const storageKey = await resource.getStorageKey(source);

      expect(stubSpecification.getStorageKey).toHaveBeenCalledWith(source);
      expect(storageKey).toBe("test-storage-key");
    });
  });

  describe("satisfiesKeySpec", () => {
    it("should delegate to spec.satisfiesKeySpec", () => {
      stubSpecification.satisfiesKeySpec.mockReturnValue(true);

      const result = resource.satisfiesKeySpec(idempotencyKey);

      expect(result).toBe(true);
    });
  });
});
