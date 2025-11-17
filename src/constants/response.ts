/**
 * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-2.7}
 */

import type {
  DocumentationConfig,
  DocumentationSections,
} from "../config/documentation";
import type { SerializedResponse } from "../serializer";

import {
  createDocumentationConfig,
  getDocumentationUrl,
} from "../config/documentation";

/**
 * Default documentation configuration
 */
const DEFAULT_DOCUMENTATION_CONFIG = createDocumentationConfig();

/**
 * Creates an enhanced error response with RFC7807 Problem Details compliance
 * and documentation links
 *
 * @param config - Documentation configuration
 * @param errorType - Type of error for documentation linking
 * @param status - HTTP status code
 * @param statusText - HTTP status text
 * @param title - Error title
 * @param detail - Error detail description
 * @returns Enhanced error response with type field and Link header
 */
export function createEnhancedErrorResponse(
  config: DocumentationConfig,
  errorType: keyof DocumentationSections,
  status: number,
  statusText: string,
  title: string,
  detail: string,
): SerializedResponse {
  const documentationUrl = getDocumentationUrl(config, errorType);

  return {
    body: JSON.stringify({
      detail,
      title,
      type: documentationUrl,
    }),
    headers: {
      "Content-Type": "application/problem+json",
      Link: `<${documentationUrl}>; rel="help"`,
    },
    status,
    statusText,
  } as const satisfies SerializedResponse;
}

/**
 * If the Idempotency-Key request header is missing for a documented
 * idempotent operation requiring this header, the resource SHOULD reply
 * with an HTTP 400 status code with body containing a link pointing to
 * relevant documentation.
 *
 * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-2.7}
 */
export const IDEMPOTENCY_KEY_MISSING_ERROR_RESPONSE =
  createEnhancedErrorResponse(
    DEFAULT_DOCUMENTATION_CONFIG,
    "keyMissing",
    400,
    "Bad Request",
    "Idempotency-Key is missing",
    "This operation is idempotent and it requires correct usage of Idempotency Key.",
  );

/**
 * If the request is retried, while the original request is still being
 * processed, the resource SHOULD reply with an HTTP 409 status code
 * with body containing problem description.
 *
 * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-2.7}
 */
export const IDEMPOTENCY_KEY_CONFLICT_ERROR_RESPONSE =
  createEnhancedErrorResponse(
    DEFAULT_DOCUMENTATION_CONFIG,
    "keyConflict",
    409,
    "Conflict",
    "A request is outstanding for this Idempotency-Key",
    "A request with the same Idempotency-Key for the same operation is being processed or is outstanding.",
  );

/**
 * If there is an attempt to reuse an idempotency key with a different
 * request payload, the resource SHOULD reply with a HTTP 422 status
 * code with body containing a link pointing to relevant documentation.
 *
 * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-2.7}
 */
export const IDEMPOTENCY_KEY_PAYLOAD_MISMATCH_ERROR_RESPONSE =
  createEnhancedErrorResponse(
    DEFAULT_DOCUMENTATION_CONFIG,
    "keyMismatch",
    422,
    "Unprocessable Content",
    "Idempotency-Key is already used",
    "This operation is idempotent and it requires correct usage of Idempotency Key. Idempotency Key MUST not be reused across different payloads of this operation.",
  );
