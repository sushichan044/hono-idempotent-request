import { parseItem, serializeItem } from "structured-headers";

/**
 * Idempotency-Key is an Item Structured Header [RFC8941].
 *
 * Its value MUST be a String (Section 3.3.3 of [RFC8941]).
 *
 * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07#section-2.1 2.1. Syntax - draft-ietf-httpapi-idempotency-key-header-07}
 *
 * @see {@link https://datatracker.ietf.org/doc/html/rfc8941#section-3.3.3 3.3.3. Strings - RFC8941}
 *
 * @param rawIdempotencyKey - The raw Idempotency-Key header value.
 * @returns The parsed Idempotency-Key value.
 */
export function parseStructuredIdempotencyKey(
  rawIdempotencyKey: string,
): string {
  const [parsed] = parseItem(serializeItem(rawIdempotencyKey));

  if (typeof parsed !== "string") {
    throw new Error(
      "IdempotencyKey does not fit the String Item format of Structured Headers.",
    );
  }

  return parsed;
}
