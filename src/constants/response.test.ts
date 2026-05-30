import { describe, expect, it } from "vite-plus/test";

import { createDocumentationConfig } from "../config/documentation";
import {
  createEnhancedErrorResponse,
  IDEMPOTENCY_KEY_CONFLICT_ERROR_RESPONSE,
  IDEMPOTENCY_KEY_MISSING_ERROR_RESPONSE,
  IDEMPOTENCY_KEY_PAYLOAD_MISMATCH_ERROR_RESPONSE,
} from "./response";

describe("Error Response Constants", () => {
  describe("Enhanced Error Responses", () => {
    it("should include type field in missing key error response", () => {
      const body = JSON.parse(IDEMPOTENCY_KEY_MISSING_ERROR_RESPONSE.body) as Record<
        string,
        unknown
      >;
      expect(body).toHaveProperty("type");
      expect(body["type"]).toBe(
        "https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07#section-2.7",
      );
    });

    it("should include type field in conflict error response", () => {
      const body = JSON.parse(IDEMPOTENCY_KEY_CONFLICT_ERROR_RESPONSE.body) as Record<
        string,
        unknown
      >;
      expect(body).toHaveProperty("type");
      expect(body["type"]).toBe(
        "https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07#section-2.7",
      );
    });

    it("should include type field in mismatch error response", () => {
      const body = JSON.parse(IDEMPOTENCY_KEY_PAYLOAD_MISMATCH_ERROR_RESPONSE.body) as Record<
        string,
        unknown
      >;
      expect(body).toHaveProperty("type");
      expect(body["type"]).toBe(
        "https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07#section-2.7",
      );
    });

    it("should maintain RFC7807 Problem Details compliance", () => {
      const missingBody = JSON.parse(IDEMPOTENCY_KEY_MISSING_ERROR_RESPONSE.body) as Record<
        string,
        unknown
      >;
      const conflictBody = JSON.parse(IDEMPOTENCY_KEY_CONFLICT_ERROR_RESPONSE.body) as Record<
        string,
        unknown
      >;
      const mismatchBody = JSON.parse(
        IDEMPOTENCY_KEY_PAYLOAD_MISMATCH_ERROR_RESPONSE.body,
      ) as Record<string, unknown>;

      // Check required RFC7807 fields
      for (const body of [missingBody, conflictBody, mismatchBody]) {
        expect(body).toHaveProperty("type");
        expect(body).toHaveProperty("title");
        expect(body).toHaveProperty("detail");
      }

      // Check Content-Type header
      expect(IDEMPOTENCY_KEY_MISSING_ERROR_RESPONSE.headers["Content-Type"]).toBe(
        "application/problem+json",
      );
      expect(IDEMPOTENCY_KEY_CONFLICT_ERROR_RESPONSE.headers["Content-Type"]).toBe(
        "application/problem+json",
      );
      expect(IDEMPOTENCY_KEY_PAYLOAD_MISMATCH_ERROR_RESPONSE.headers["Content-Type"]).toBe(
        "application/problem+json",
      );
    });
  });

  describe("createEnhancedErrorResponse", () => {
    it("should create error response with custom documentation URL", () => {
      const config = createDocumentationConfig("https://example.com/docs");
      const response = createEnhancedErrorResponse(
        config,
        "keyMissing",
        400,
        "Bad Request",
        "Missing Key",
        "The idempotency key is missing",
      );

      const body = JSON.parse(response.body) as Record<string, unknown>;
      expect(body["type"]).toBe("https://example.com/docs#section-2.7");
      expect(body["title"]).toBe("Missing Key");
      expect(body["detail"]).toBe("The idempotency key is missing");
      expect(response.status).toBe(400);
      expect(response.statusText).toBe("Bad Request");
    });

    it("should include Link header as alternative", () => {
      const config = createDocumentationConfig();
      const response = createEnhancedErrorResponse(
        config,
        "keyMissing",
        400,
        "Bad Request",
        "Missing Key",
        "The idempotency key is missing",
      );

      expect(response.headers).toHaveProperty("Link");
      expect(response.headers["Link"]).toContain(
        "https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07#section-2.7",
      );
      expect(response.headers["Link"]).toContain('rel="describedby"');
      expect(response.headers["Link"]).toContain('type="text/html"');
    });

    it("should have correct content type", () => {
      const config = createDocumentationConfig();
      const response = createEnhancedErrorResponse(
        config,
        "keyMissing",
        400,
        "Bad Request",
        "Missing Key",
        "The idempotency key is missing",
      );

      expect(response.headers["Content-Type"]).toBe("application/problem+json");
    });
  });
});
