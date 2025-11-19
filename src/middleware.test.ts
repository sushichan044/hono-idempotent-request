import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IdempotentRequestServerSpecification } from "./server/types";
import type { IdempotentRequestStorageAdapter } from "./storage/types";

import { createInMemoryAdapter } from "../tests/utils/in-memory-adapter";
import { createRacer, racerMiddleware } from "../tests/utils/racer";
import { createTestServerSpecification } from "../tests/utils/server-specification";
import { idempotentRequest } from "./middleware";

describe("idempotentRequest Middleware", () => {
  function createTestApp(options?: {
    serverSpecification?: IdempotentRequestServerSpecification;
    storageAdapter?: IdempotentRequestStorageAdapter;
  }) {
    const {
      serverSpecification = createTestServerSpecification(),
      storageAdapter = createInMemoryAdapter(),
    } = options ?? {};

    const app = new Hono()
      .use(
        "*",
        idempotentRequest({
          activationStrategy: (request) => {
            return ["PATCH", "POST"].includes(request.method);
          },
          server: {
            specification: serverSpecification,
          },
          storage: {
            adapter: storageAdapter,
          },
        }),
      )
      .post("/api/test", (c) => {
        return c.json({ message: "Test passed" });
      })
      .post("/api/error", () => {
        throw new Error("Internal Server Error");
      });

    return app;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Happy path", () => {
    const memoryAdapter = createInMemoryAdapter();
    const adapterSaveSpy = vi.spyOn(memoryAdapter, "save");

    it("should process request successfully with valid Idempotency-Key", async () => {
      const app = createTestApp({ storageAdapter: memoryAdapter });

      const response = await app.request("/api/test", {
        body: JSON.stringify({ name: "Edison" }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": uuidv4(),
        },
        method: "POST",
      });
      const json = (await response.json()) as Record<string, string>;

      expect(response.status).toBe(200);
      expect(json["message"]).toBe("Test passed");
    });

    it("should return cached response on subsequent requests with same Idempotency-Key", async () => {
      const app = createTestApp({ storageAdapter: memoryAdapter });
      const idempotencyKey = uuidv4();

      const createRequest = () => ({
        body: JSON.stringify({ name: "Edison" }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        method: "POST" as const,
      });

      const response = await app.request("/api/test", createRequest());
      const json = (await response.json()) as Record<string, string>;

      const cachedResponse = await app.request("/api/test", createRequest());
      const cachedJson = (await cachedResponse.json()) as Record<
        string,
        string
      >;

      expect(cachedResponse.status).toBe(response.status);
      expect(cachedJson["message"]).toBe(json["message"]);
      expect(adapterSaveSpy).toHaveBeenCalledOnce();
    });
  });

  describe("Error Scenarios in Draft", () => {
    // https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-2.7

    it("should return 400 if Idempotency-Key header is missing", async () => {
      const app = createTestApp();

      const response = await app.request("/api/test", {
        body: JSON.stringify({ name: "Edison" }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json).toMatchObject({
        detail:
          "This operation is idempotent and it requires correct usage of Idempotency Key.",
        title: "Idempotency-Key is missing",
      });
    });

    it("should return 400 if Idempotency-Key does not satisfy the server specification", async () => {
      const app = createTestApp();

      const response = await app.request("/api/test", {
        body: JSON.stringify({ name: "John" }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "invalid-key",
        },
        method: "POST",
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json).toMatchObject({
        detail:
          "This operation is idempotent and it requires correct usage of Idempotency Key.",
        title: "Idempotency-Key is missing",
      });
    });

    it("should return 422 if Idempotency-Key is reused with different request payload", async () => {
      const app = createTestApp();
      const idempotencyKey = uuidv4();

      const firstRequest = {
        body: JSON.stringify({ name: "john" }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        method: "POST" as const,
      };

      const secondRequest = {
        body: JSON.stringify({ name: "UNEXPECTED BODY" }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        method: "POST" as const,
      };

      const response = await app.request("/api/test", firstRequest);
      const abusedResponse = await app.request("/api/test", secondRequest);

      expect(response.status).toBe(200);
      expect(abusedResponse.status).toBe(422);
      const json = await abusedResponse.json();
      expect(json).toMatchObject({
        detail:
          "This operation is idempotent and it requires correct usage of Idempotency Key. Idempotency Key MUST not be reused across different payloads of this operation.",
        title: "Idempotency-Key is already used",
      });
    });

    it.skip("should handle concurrent requests with same Idempotency-Key", async () => {
      const memoryAdapter = createInMemoryAdapter();
      const racer = createRacer({
        concurrency: 2,
        totalDelayOnServer: 100,
      });

      const app = new Hono();

      app.use(
        "*",
        racerMiddleware({
          activation: (request) =>
            request.headers.get("X-Simulate-Slow") === "true",
          racer,
        }),
      );

      app.use(
        "*",
        idempotentRequest({
          activationStrategy: (request) => {
            return ["PATCH", "POST"].includes(request.method);
          },
          server: {
            specification: createTestServerSpecification(),
          },
          storage: {
            adapter: memoryAdapter,
          },
        }),
      );

      app.post("/api/test", (c) => {
        return c.json({ message: "Test passed" });
      });

      const idempotencyKey = uuidv4();

      const createRequest = (headers: Record<string, string> = {}) => ({
        body: JSON.stringify({ name: "John" }),
        headers: {
          ...headers,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        method: "POST" as const,
      });

      const firstSlowRequest = async () =>
        await app.request(
          "/api/test",
          createRequest({
            "X-Simulate-Slow": "true",
          }),
        );

      const secondRequest = async () => {
        // Wait for first request to pass through racer middleware and acquire lock
        // First request waits 50ms in racer, so we wait a bit more to ensure it has acquired the lock
        await new Promise((resolve) => setTimeout(resolve, 55));
        return await app.request("/api/test", createRequest());
      };

      const [successResponse, conflictResponse] = await Promise.all([
        firstSlowRequest(),
        secondRequest(),
      ]);

      expect(successResponse.status).toBe(200);
      expect(conflictResponse.status).toBe(409);
      const json = await conflictResponse.json();
      expect(json).toMatchObject({
        detail:
          "A request with the same Idempotency-Key for the same operation is being processed or is outstanding.",
        title: "A request is outstanding for this Idempotency-Key",
      });
    });
  });

  describe("Error handling", () => {
    it("should cache the error response", async () => {
      const memoryAdapter = createInMemoryAdapter();
      const adapterSaveSpy = vi.spyOn(memoryAdapter, "save");
      const app = createTestApp({ storageAdapter: memoryAdapter });

      const request = {
        headers: {
          "Idempotency-Key": uuidv4(),
        },
        method: "POST" as const,
      };

      const response = await app.request("/api/error", request);
      const text = await response.text();

      const cachedResponse = await app.request("/api/error", request);
      const cachedText = await cachedResponse.text();

      expect(cachedResponse.status).toBe(response.status);
      expect(cachedText).toBe(text);
      expect(adapterSaveSpy).toHaveBeenCalledOnce();
    });
  });

  describe("Unsafe implementation detection", () => {
    it("should throw an error if the storage key does not include the Idempotency-Key header", async () => {
      const app = createTestApp({
        serverSpecification: {
          getFingerprint: () => null,
          getStorageKey: () => "",
          satisfiesKeySpec: () => true,
        },
      });

      const response = await app.request("/api/test", {
        headers: {
          "Idempotency-Key": uuidv4(),
        },
        method: "POST",
      });

      expect(response.status).toBe(500);
    });
  });
});
