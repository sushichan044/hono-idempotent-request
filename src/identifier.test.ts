import { describe, expect, it } from "vitest";

import type { RequestIdentifier } from "./identifier";

import { createIdempotencyFingerprint } from "./brand";
import { isIdenticalRequest } from "./identifier";

describe("isIdenticalRequest", () => {
  const base: RequestIdentifier = {
    fingerprint: createIdempotencyFingerprint("fp1"),
    idempotencyKey: "key1",
    requestMethod: "GET",
    requestPath: "/api/test",
  };

  it("returns true for identical requests", () => {
    const candidate: RequestIdentifier = { ...base };
    expect(isIdenticalRequest(base, candidate)).toBe(true);
  });

  it("returns false when request method differs", () => {
    const candidate: RequestIdentifier = { ...base, requestMethod: "POST" };
    expect(isIdenticalRequest(base, candidate)).toBe(false);
  });

  it("returns false when request path differs", () => {
    const candidate: RequestIdentifier = { ...base, requestPath: "/api/other" };
    expect(isIdenticalRequest(base, candidate)).toBe(false);
  });

  it("returns false when idempotencyKey differs", () => {
    const candidate: RequestIdentifier = { ...base, idempotencyKey: "key2" };
    expect(isIdenticalRequest(base, candidate)).toBe(false);
  });

  it("returns false when fingerprint differs", () => {
    const candidate: RequestIdentifier = {
      ...base,
      fingerprint: createIdempotencyFingerprint("fp2"),
    };
    expect(isIdenticalRequest(base, candidate)).toBe(false);
  });

  it("returns true when both fingerprints are null", () => {
    const target: RequestIdentifier = { ...base, fingerprint: null };
    const candidate: RequestIdentifier = { ...base, fingerprint: null };
    expect(isIdenticalRequest(target, candidate)).toBe(true);
  });

  it("returns false when one fingerprint is null and the other is not", () => {
    const target: RequestIdentifier = { ...base, fingerprint: null };
    const candidate: RequestIdentifier = {
      ...base,
      fingerprint: createIdempotencyFingerprint("fp1"),
    };
    expect(isIdenticalRequest(target, candidate)).toBe(false);
  });
});
