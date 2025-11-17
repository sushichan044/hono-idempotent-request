/**
 * Documentation configuration for error responses
 * Provides configurable URLs for RFC documentation links
 */

export interface DocumentationSections {
  /** Section for key conflict errors */
  keyConflict: string;
  /** Section for key mismatch errors */
  keyMismatch: string;
  /** Section for key missing errors */
  keyMissing: string;
}

export interface DocumentationConfig {
  /** Base URL for documentation */
  baseUrl: string;
  /** Sections within the documentation */
  sections: DocumentationSections;
}

/**
 * Default documentation sections pointing to RFC draft sections
 */
const DEFAULT_SECTIONS: DocumentationSections = {
  keyConflict: "#section-2.7",
  keyMismatch: "#section-2.7",
  keyMissing: "#section-2.7",
};

/**
 * Default base URL for RFC documentation
 */
const DEFAULT_BASE_URL =
  "https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06";

/**
 * Create a documentation configuration
 *
 * @param baseUrl - Base URL for documentation (defaults to RFC draft URL)
 * @param sections - Custom section mappings (defaults to RFC sections)
 * @returns Documentation configuration object
 */
export function createDocumentationConfig(
  baseUrl: string = DEFAULT_BASE_URL,
  sections: Partial<DocumentationSections> = {},
): DocumentationConfig {
  return {
    baseUrl,
    sections: {
      ...DEFAULT_SECTIONS,
      ...sections,
    },
  };
}

/**
 * Get the full documentation URL for a specific error type
 *
 * @param config - Documentation configuration
 * @param errorType - Type of error (keyMissing, keyConflict, keyMismatch)
 * @returns Full URL to the relevant documentation section
 */
export function getDocumentationUrl(
  config: DocumentationConfig,
  errorType: keyof DocumentationSections,
): string {
  return `${config.baseUrl}${config.sections[errorType]}`;
}
