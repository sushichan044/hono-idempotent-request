import { describe, expect, it } from "vite-plus/test";

import type { IdempotencyActivationStrategy } from "./strategy";
import { resolveStrategy } from "./strategy";

const createMockRequest = (definedHeaders: Record<string, string> = {}): Request => {
  const headers = new Headers(definedHeaders);

  return new Request("http://example.com", {
    headers,
  });
};

describe("prepareActivationStrategy", () => {
  it("should return a function that always returns true when strategy is 'always'", async () => {
    const strategy = resolveStrategy("always");
    const request = createMockRequest();

    expect(await strategy(request)).toBe(true);
  });

  it("should return a function that checks Idempotency-Key header when strategy is 'opt-in-with-key'", async () => {
    const strategy = resolveStrategy("opt-in-with-key");

    const mockRequestWithoutKey = createMockRequest();
    const mockRequestWithEmptyKey = createMockRequest({
      "idempotency-key": "",
    });
    const mockRequestWithKey = createMockRequest({
      "idempotency-key": "key-value",
    });

    expect(await strategy(mockRequestWithoutKey)).toBe(false);
    // Empty string is considered as opt-in.
    expect(await strategy(mockRequestWithEmptyKey)).toBe(true);
    expect(await strategy(mockRequestWithKey)).toBe(true);
  });

  it("should return the function as is when strategy is a function", async () => {
    const strategy = resolveStrategy((req) => req.headers.get("X-Enable-Idempotency") === "true");

    const mockRequestWithHeader = createMockRequest({
      "x-enable-idempotency": "true",
    });
    const mockRequestWithoutHeader = createMockRequest();

    expect(await strategy(mockRequestWithHeader)).toBe(true);
    expect(await strategy(mockRequestWithoutHeader)).toBe(false);
  });

  it("should throw an error when strategy is invalid", () => {
    const invalidStrategy = "invalid-strategy";
    expect(() => resolveStrategy(invalidStrategy as IdempotencyActivationStrategy)).toThrow(
      `Invalid activation strategy: ${invalidStrategy}`,
    );
  });
});
