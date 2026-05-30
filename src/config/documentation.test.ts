import { describe, expect, it } from "vite-plus/test";

import { createDocumentationConfig, getDocumentationUrl } from "./documentation";

describe("Documentation Configuration", () => {
  describe("createDocumentationConfig", () => {
    it("should create config with default URL", () => {
      const config = createDocumentationConfig();
      expect(config.baseUrl).toBe(
        "https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07",
      );
    });

    it("should create config with custom URL", () => {
      const customUrl = "https://example.com/docs";
      const config = createDocumentationConfig(customUrl);
      expect(config.baseUrl).toBe(customUrl);
    });

    it("should create config with custom section URLs", () => {
      const config = createDocumentationConfig("https://example.com/docs", {
        keyConflict: "#conflict",
        keyMismatch: "#mismatch",
        keyMissing: "#missing",
      });
      expect(config.sections.keyMissing).toBe("#missing");
      expect(config.sections.keyConflict).toBe("#conflict");
      expect(config.sections.keyMismatch).toBe("#mismatch");
    });
  });

  describe("getDocumentationUrl", () => {
    it("should return full URL for key missing error", () => {
      const config = createDocumentationConfig();
      const url = getDocumentationUrl(config, "keyMissing");
      expect(url).toBe(
        "https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07#section-2.7",
      );
    });

    it("should return full URL for key conflict error", () => {
      const config = createDocumentationConfig();
      const url = getDocumentationUrl(config, "keyConflict");
      expect(url).toBe(
        "https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07#section-2.7",
      );
    });

    it("should return full URL for key mismatch error", () => {
      const config = createDocumentationConfig();
      const url = getDocumentationUrl(config, "keyMismatch");
      expect(url).toBe(
        "https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07#section-2.7",
      );
    });

    it("should work with custom configuration", () => {
      const config = createDocumentationConfig("https://example.com/docs", {
        keyConflict: "#conflict-key",
        keyMismatch: "#mismatch-key",
        keyMissing: "#missing-key",
      });
      const url = getDocumentationUrl(config, "keyMissing");
      expect(url).toBe("https://example.com/docs#missing-key");
    });
  });
});
