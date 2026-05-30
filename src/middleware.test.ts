import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { createInMemoryAdapter } from "../tests/utils/in-memory-adapter";
import { createTestResource } from "../tests/utils/server-specification";
import { idempotentRequest } from "./middleware";
import type { ResourceSpecification } from "./resource";
import type { StorageAdapter } from "./storage/types";

describe("idempotentRequest Middleware", () => {
  function createTestApp(options?: { spec?: ResourceSpecification; storage?: StorageAdapter }) {
    const { spec: resource = createTestResource(), storage: adapter = createInMemoryAdapter() } =
      options ?? {};

    const app = new Hono()
      .use(
        "*",
        idempotentRequest({
          activationStrategy: (request) => ["PATCH", "POST"].includes(request.method),
          resource,
          storage: {
            adapter,
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
    vi.resetAllMocks();
  });

  describe("Happy path", () => {
    const memoryAdapter = createInMemoryAdapter();
    const adapterSaveSpy = vi.spyOn(memoryAdapter, "save");

    it("should process request successfully with valid Idempotency-Key", async () => {
      const app = createTestApp({ storage: memoryAdapter });

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
      const app = createTestApp({ storage: memoryAdapter });
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
      const cachedJson = (await cachedResponse.json()) as Record<string, string>;

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
        detail: "This operation is idempotent and it requires correct usage of Idempotency Key.",
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
        detail: "This operation is idempotent and it requires correct usage of Idempotency Key.",
        title: "Idempotency-Key is missing",
      });
    });

    it("should return 400 for malformed Idempotency-Key header (parse error)", async () => {
      const app = createTestApp();

      const response = await app.request("/api/test", {
        body: JSON.stringify({ name: "John" }),
        headers: {
          "Content-Type": "application/json",
          // Invalid structured header - contains comma which has special meaning
          "Idempotency-Key": "invalid,structured,header",
        },
        method: "POST",
      });

      expect(response.status).toBe(400);
    });

    it("should return 400 when Idempotency-Key is missing with default strategy", async () => {
      // Test default strategy (not specifying activationStrategy)
      const app = new Hono()
        .use(
          "*",
          idempotentRequest({
            // activationStrategy not specified - defaults to "always"
            resource: createTestResource(),
            storage: {
              adapter: createInMemoryAdapter(),
            },
          }),
        )
        .post("/api/test", (c) => c.json({ ok: true }));

      const response = await app.request("/api/test", {
        body: JSON.stringify({ test: true }),
        method: "POST",
      });

      expect(response.status).toBe(400);
    });

    it("should skip idempotency with opt-in-with-key strategy when header is missing", async () => {
      const app = new Hono()
        .use(
          "*",
          idempotentRequest({
            activationStrategy: "opt-in-with-key",
            resource: createTestResource(),
            storage: {
              adapter: createInMemoryAdapter(),
            },
          }),
        )
        .post("/api/test", (c) => c.json({ ok: true }));

      const response = await app.request("/api/test", {
        body: JSON.stringify({ test: true }),
        method: "POST",
      });

      expect(response.status).toBe(200); // Middleware is skipped, normal processing
      const json = await response.json();
      expect(json).toMatchObject({ ok: true });
    });

    it("should handle concurrent requests with same Idempotency-Key", async () => {
      const memoryAdapter = createInMemoryAdapter();
      const waitOnServer = 100; //ms
      const waitOnClient = waitOnServer / 2;
      const sleep = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      const app = new Hono<{ Bindings: { simulateSlow: boolean } }>()
        .use(
          "*",
          idempotentRequest({
            activationStrategy: (request) => {
              return ["PATCH", "POST"].includes(request.method);
            },
            resource: createTestResource(),
            storage: {
              adapter: memoryAdapter,
            },
          }),
          async (c, next) => {
            if (c.env.simulateSlow) {
              await sleep(waitOnServer);
            }
            return await next();
          },
        )
        .post("/api/test", (c) => {
          return c.json({ message: "Test passed" });
        });
      const idempotencyKey = uuidv4();

      const createRequest = () =>
        new Request("http://localhost/api/test", {
          body: JSON.stringify({ name: "Edison" }),
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          method: "POST",
        });

      const firstSlowRequest = async () => {
        return await app.request(createRequest(), undefined, {
          simulateSlow: true,
        });
      };
      const secondRequest = async () => {
        await sleep(waitOnClient);
        return await app.request(createRequest(), undefined, {
          simulateSlow: false,
        });
      };

      const [successResponse, conflictResponse] = await Promise.all([
        firstSlowRequest(),
        secondRequest(),
      ]);

      expect(successResponse.status).toBe(200);
      expect(conflictResponse.status).toBe(409);
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
  });

  describe("Error handling", () => {
    it("should cache the error response", async () => {
      const memoryAdapter = createInMemoryAdapter();
      const adapterSaveSpy = vi.spyOn(memoryAdapter, "save");
      const app = createTestApp({ storage: memoryAdapter });

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
        spec: {
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
